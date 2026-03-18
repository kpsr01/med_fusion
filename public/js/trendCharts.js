(function () {
  'use strict';

  const root = document.getElementById('trendCharts');

  let mainChart = null;
  let ihmeChart = null;
  let currentPayload = null;
  let selectedRange = '30';
  let selectedMode = 'cumulative';

  const RANGE_OPTIONS = [
    { label: '7d', value: '7' },
    { label: '30d', value: '30' },
    { label: '90d', value: '90' },
    { label: 'All', value: 'all' },
  ];

  function destroyCharts() {
    if (mainChart) {
      mainChart.destroy();
      mainChart = null;
    }
    if (ihmeChart) {
      ihmeChart.destroy();
      ihmeChart = null;
    }
  }

  function parseDateLabel(label) {
    const date = new Date(label);
    if (!Number.isNaN(date.getTime())) return date;
    return new Date();
  }

  function buildTimelineRows(diseaseSh) {
    const timeline = diseaseSh && diseaseSh.historical && diseaseSh.historical.timeline;
    if (!timeline || !timeline.cases) return [];

    const labels = Object.keys(timeline.cases);
    const rows = labels.map((dateLabel) => ({
      dateLabel,
      dateObj: parseDateLabel(dateLabel),
      cases: Number(timeline.cases[dateLabel]) || 0,
      deaths: Number(timeline.deaths && timeline.deaths[dateLabel]) || 0,
      recovered: Number(timeline.recovered && timeline.recovered[dateLabel]) || 0,
    }));

    rows.sort((a, b) => a.dateObj - b.dateObj);
    return rows;
  }

  function dailyValues(values) {
    return values.map((value, index) => {
      if (index === 0) return 0;
      const delta = value - values[index - 1];
      return delta > 0 ? delta : 0;
    });
  }

  function applyRange(rows) {
    if (selectedRange === 'all') return rows;
    const count = Number(selectedRange);
    if (!Number.isFinite(count) || count <= 0) return rows;
    if (rows.length <= count) return rows;
    return rows.slice(rows.length - count);
  }

  function chartShell() {
    const rangeButtons = RANGE_OPTIONS.map((option) => {
      const activeClass = option.value === selectedRange ? ' is-active' : '';
      return `<button type="button" class="chart-toggle${activeClass}" data-action="range" data-value="${option.value}">${option.label}</button>`;
    }).join('');

    return `
      <article class="card chart-card">
        <div class="card__header chart-card__header">
          <h2>Epidemiological Trend Signals</h2>
          <span class="badge badge--source">via Disease.sh + IHME GHDx</span>
        </div>
        <div class="card__body">
          <div class="chart-toolbar">
            <div class="chart-toolbar__group">
              ${rangeButtons}
            </div>
            <div class="chart-toolbar__group">
              <button type="button" class="chart-toggle${selectedMode === 'cumulative' ? ' is-active' : ''}" data-action="mode" data-value="cumulative">Cumulative</button>
              <button type="button" class="chart-toggle${selectedMode === 'daily' ? ' is-active' : ''}" data-action="mode" data-value="daily">Daily New</button>
            </div>
          </div>
          <div class="chart-grid">
            <section class="chart-panel">
              <p class="chart-panel__title">Cases / Deaths / Recovered Timeline</p>
              <div class="chart-canvas-wrap"><canvas id="epiMainChart" aria-label="Disease trend chart" role="img"></canvas></div>
            </section>
            <section class="chart-panel" id="ihmeChartPanel">
              <p class="chart-panel__title">IHME Multi-year Burden Trend</p>
              <div class="chart-canvas-wrap"><canvas id="ihmeTrendChart" aria-label="IHME trend chart" role="img"></canvas></div>
            </section>
          </div>
        </div>
      </article>
    `;
  }

  function getIhmeSeries(ihme) {
    const records = ihme && Array.isArray(ihme.records) ? ihme.records : [];
    const valid = records
      .filter((record) => record && record.year !== undefined && Number.isFinite(Number(record.value)))
      .map((record) => ({
        measure: record.measure || 'Unknown',
        year: Number(record.year),
        value: Number(record.value),
      }))
      .filter((record) => Number.isFinite(record.year));

    if (valid.length < 2) return null;

    const byMeasure = {};
    for (const record of valid) {
      if (!byMeasure[record.measure]) byMeasure[record.measure] = [];
      byMeasure[record.measure].push(record);
    }

    const ranked = Object.entries(byMeasure)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4);

    if (ranked.length === 0) return null;

    const years = Array.from(new Set(valid.map((record) => record.year))).sort((a, b) => a - b);
    const palette = ['#7e5bef', '#5fb8ff', '#35d6a7', '#f8c86f'];

    const datasets = ranked.map(([measure, measureRows], index) => {
      const map = new Map(measureRows.map((row) => [row.year, row.value]));
      return {
        label: measure,
        data: years.map((year) => (map.has(year) ? map.get(year) : null)),
        borderColor: palette[index % palette.length],
        backgroundColor: palette[index % palette.length],
        tension: 0.26,
        spanGaps: true,
      };
    });

    return {
      years,
      datasets,
    };
  }

  function renderMainChart(rows) {
    const canvas = document.getElementById('epiMainChart');
    if (!canvas || !window.Chart) return;

    const labels = rows.map((row) => row.dateLabel);
    const rawCases = rows.map((row) => row.cases);
    const rawDeaths = rows.map((row) => row.deaths);
    const rawRecovered = rows.map((row) => row.recovered);

    const isDaily = selectedMode === 'daily';
    const cases = isDaily ? dailyValues(rawCases) : rawCases;
    const deaths = isDaily ? dailyValues(rawDeaths) : rawDeaths;
    const recovered = isDaily ? dailyValues(rawRecovered) : rawRecovered;

    const yLabel = isDaily ? 'Daily new counts' : 'Cumulative counts';

    mainChart = new window.Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Cases',
            data: cases,
            borderColor: '#5fb8ff',
            backgroundColor: 'rgba(95, 184, 255, 0.2)',
            fill: false,
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.28,
          },
          {
            label: 'Deaths',
            data: deaths,
            borderColor: '#ff6f88',
            backgroundColor: 'rgba(255, 111, 136, 0.2)',
            fill: false,
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.28,
          },
          {
            label: 'Recovered',
            data: recovered,
            borderColor: '#35d6a7',
            backgroundColor: 'rgba(53, 214, 167, 0.2)',
            fill: false,
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.28,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            labels: {
              color: '#d9e7ff',
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                return `${context.dataset.label}: ${window.Utils.formatNumber(context.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#8ea5cb', maxTicksLimit: 8 },
            grid: { color: 'rgba(157, 187, 232, 0.12)' },
          },
          y: {
            title: {
              display: true,
              text: yLabel,
              color: '#8ea5cb',
            },
            ticks: {
              color: '#8ea5cb',
              callback(value) {
                return window.Utils.formatNumber(value);
              },
            },
            grid: { color: 'rgba(157, 187, 232, 0.12)' },
          },
        },
      },
    });
  }

  function renderIhmeChart(ihme) {
    const panel = document.getElementById('ihmeChartPanel');
    const canvas = document.getElementById('ihmeTrendChart');
    if (!panel || !canvas || !window.Chart) return;

    const series = getIhmeSeries(ihme);
    if (!series) {
      panel.innerHTML = `
        <p class="chart-panel__title">IHME Multi-year Burden Trend</p>
        <p class="chart-empty">IHME multi-year records are not available for this query.</p>
      `;
      return;
    }

    ihmeChart = new window.Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: series.years,
        datasets: series.datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#d9e7ff' },
          },
          tooltip: {
            callbacks: {
              label(context) {
                return `${context.dataset.label}: ${window.Utils.formatNumber(context.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#8ea5cb' },
            grid: { color: 'rgba(157, 187, 232, 0.12)' },
          },
          y: {
            ticks: {
              color: '#8ea5cb',
              callback(value) {
                return window.Utils.formatNumber(value);
              },
            },
            grid: { color: 'rgba(157, 187, 232, 0.12)' },
          },
        },
      },
    });
  }

  function render() {
    if (!root) return;
    destroyCharts();

    const payload = currentPayload;
    const epi = payload && payload.results ? payload.results.epidemiological : null;
    const diseaseSh = epi && epi['Disease.sh'];
    const ihme = epi && epi['IHME GHDx'];

    if (!window.Chart) {
      root.innerHTML = '<article class="card"><div class="card__body"><p>Chart.js is unavailable. Trend charts cannot be rendered.</p></div></article>';
      return;
    }

    const timelineRows = applyRange(buildTimelineRows(diseaseSh));
    if (timelineRows.length === 0) {
      root.innerHTML = `
        <article class="card">
          <div class="card__header">
            <h2>Epidemiological Trend Signals</h2>
            <span class="badge badge--warning">No timeline data</span>
          </div>
          <div class="card__body">
            <p>Disease.sh timeline data is not available for this query. Try a COVID-19 query for full trend coverage.</p>
          </div>
        </article>
      `;
      return;
    }

    root.innerHTML = chartShell();
    renderMainChart(timelineRows);
    renderIhmeChart(ihme);
  }

  function onToolbarClick(event) {
    const button = event.target.closest('.chart-toggle');
    if (!button) return;

    const action = button.getAttribute('data-action');
    const value = button.getAttribute('data-value');
    if (!action || !value) return;

    if (action === 'range') {
      selectedRange = value;
      render();
      return;
    }

    if (action === 'mode') {
      selectedMode = value;
      render();
    }
  }

  function clearForLoading() {
    currentPayload = null;
    destroyCharts();
    if (!root) return;
    root.innerHTML = '';
  }

  function init() {
    if (!root) return;

    root.addEventListener('click', onToolbarClick);

    window.addEventListener('search:start', clearForLoading);
    window.addEventListener('search:complete', (event) => {
      currentPayload = event && event.detail ? event.detail.data : null;
      selectedRange = '30';
      selectedMode = 'cumulative';
      render();
    });
  }

  window.TrendChartsModule = {
    init,
  };
})();
