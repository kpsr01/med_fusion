(function () {
  'use strict';

  const root = document.getElementById('outbreakTimeline');
  let timelineChart = null;
  let allAlerts = [];
  let filterState = { sourceFilter: 'all', dateFilter: 'all' };

  function destroyChart() {
    if (timelineChart) {
      timelineChart.destroy();
      timelineChart = null;
    }
  }

  function applyFilters(alerts) {
    let rows = alerts.slice();
    if (filterState.sourceFilter !== 'all') {
      rows = rows.filter((alert) => String(alert.source || '').toLowerCase().includes(filterState.sourceFilter));
    }

    if (filterState.dateFilter !== 'all') {
      const days = Number(filterState.dateFilter);
      if (Number.isFinite(days) && days > 0) {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        rows = rows.filter((alert) => alert.dateObj && alert.dateObj.getTime() >= cutoff);
      }
    }

    return rows;
  }

  function buildSeries(alerts) {
    const buckets = new Map();
    for (const alert of alerts) {
      if (!alert.dateObj) continue;
      const key = alert.dateObj.toISOString().slice(0, 10);
      const current = buckets.get(key) || { total: 0, healthmap: 0, promed: 0, sample: alert };
      current.total += 1;
      if (String(alert.source || '').toLowerCase().includes('promed')) current.promed += 1;
      else current.healthmap += 1;
      if (!current.sample) current.sample = alert;
      buckets.set(key, current);
    }

    const keys = Array.from(buckets.keys()).sort((a, b) => new Date(a) - new Date(b));
    return {
      labels: keys,
      healthmap: keys.map((key) => buckets.get(key).healthmap),
      promed: keys.map((key) => buckets.get(key).promed),
      totals: keys.map((key) => buckets.get(key).total),
      samples: keys.map((key) => buckets.get(key).sample),
    };
  }

  function renderChart(alerts) {
    if (!root) return;
    destroyChart();

    if (!window.Chart) {
      root.innerHTML = '<article class="card"><div class="card__body"><p>Chart.js is unavailable. Timeline cannot render.</p></div></article>';
      return;
    }

    const data = buildSeries(alerts);
    if (!data.labels.length) {
      root.innerHTML = '';
      return;
    }

    root.innerHTML = `
      <article class="card">
        <div class="card__header">
          <h2>Outbreak Timeline</h2>
          <span class="badge badge--source">Alert chronology</span>
        </div>
        <div class="card__body">
          <div class="chart-canvas-wrap"><canvas id="outbreakTimelineChart" aria-label="Outbreak timeline" role="img"></canvas></div>
        </div>
      </article>
    `;

    const canvas = document.getElementById('outbreakTimelineChart');
    if (!canvas) return;

    timelineChart = new window.Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'HealthMap',
            data: data.healthmap,
            backgroundColor: 'rgba(255, 111, 136, 0.76)',
            borderColor: '#ff6f88',
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: 'ProMED Mail',
            data: data.promed,
            backgroundColor: 'rgba(95, 184, 255, 0.76)',
            borderColor: '#5fb8ff',
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            ticks: { color: '#8ea5cb', maxTicksLimit: 12 },
            grid: { color: 'rgba(157, 187, 232, 0.1)' },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { color: '#8ea5cb' },
            grid: { color: 'rgba(157, 187, 232, 0.1)' },
            title: {
              display: true,
              text: 'Alerts per day',
              color: '#8ea5cb',
            },
          },
        },
        plugins: {
          legend: {
            labels: { color: '#d9e7ff' },
          },
          tooltip: {
            callbacks: {
              afterBody(ctx) {
                if (!ctx || !ctx.length) return '';
                const index = ctx[0].dataIndex;
                const sample = data.samples[index];
                if (!sample) return '';
                return [`Sample: ${sample.title || 'Untitled alert'}`];
              },
            },
          },
        },
      },
    });
  }

  function rerender() {
    const alerts = applyFilters(allAlerts);
    renderChart(alerts);
  }

  function init() {
    if (!root) return;

    window.addEventListener('search:start', () => {
      allAlerts = [];
      filterState = { sourceFilter: 'all', dateFilter: 'all' };
      destroyChart();
      root.innerHTML = '';
    });

    window.addEventListener('alerts:normalized', (event) => {
      allAlerts = event && event.detail && Array.isArray(event.detail.alerts) ? event.detail.alerts : [];
      rerender();
    });

    window.addEventListener('alerts:filters-changed', (event) => {
      filterState = event && event.detail ? event.detail : filterState;
      rerender();
    });
  }

  window.OutbreakTimelineModule = {
    init,
  };
})();
