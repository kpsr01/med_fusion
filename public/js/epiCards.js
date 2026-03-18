(function () {
  'use strict';

  const root = document.getElementById('epidemiologicalCards');

  const SOURCE_ORDER = [
    'Disease.sh',
    'WHO GHO',
    'CDC Open Data',
    'CDC FluView',
    'IHME GHDx',
    'ECDC',
    'UKHSA',
  ];

  function sourceStatusLookup(payload) {
    const entries = payload && Array.isArray(payload.sources) ? payload.sources : [];
    const map = new Map();
    for (const entry of entries) {
      if (!entry || !entry.name) continue;
      map.set(entry.name, entry);
    }
    return map;
  }

  function dataShape(data) {
    if (!data) return 'none';
    if (Array.isArray(data)) return 'array';
    if (Array.isArray(data.records)) return 'records';
    if (Array.isArray(data.datasets)) return 'datasets';
    if (Array.isArray(data.indicators)) return 'indicators';
    if (data.metrics && typeof data.metrics === 'object') return 'metrics';
    return 'object';
  }

  function statusText(statusEntry) {
    if (!statusEntry) return 'unavailable';
    if (statusEntry.cached) return 'cached';
    return statusEntry.status || 'unknown';
  }

  function kvRows(stats) {
    return stats
      .map((item) => {
        if (!item) return '';
        return `
          <div class="epi-stat">
            <p class="epi-stat__label">${window.Utils.escapeHTML(item.label)}</p>
            <p class="epi-stat__value">${window.Utils.escapeHTML(item.value)}</p>
          </div>
        `;
      })
      .join('');
  }

  function sourceIconLabel(name) {
    const icon = window.Utils.SOURCE_ICONS[name] || 'data';
    return String(icon).slice(0, 2).toUpperCase();
  }

  function sourceHeader(sourceName, statusEntry, payloadTimestamp) {
    const color = window.Utils.SOURCE_COLORS[sourceName] || '#8ea5cb';
    const status = statusText(statusEntry);
    const latency = statusEntry && Number.isFinite(Number(statusEntry.latency))
      ? `${window.Utils.formatNumber(statusEntry.latency)} ms`
      : '--';
    const updated = payloadTimestamp ? window.Utils.timeAgo(payloadTimestamp) : '--';
    const titleStyle = sourceName === 'CDC Open Data' ? ' style="font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"' : '';

    return `
      <div class="card__header epi-card__header">
        <h2${titleStyle}>${window.Utils.escapeHTML(sourceName)}</h2>
        <span class="badge badge--source epi-source-badge" style="border-color:${color};box-shadow:inset 0 0 0 1px ${color}55;">
          <span class="epi-source-badge__icon" style="background:${color}">${window.Utils.escapeHTML(sourceIconLabel(sourceName))}</span>
          ${window.Utils.escapeHTML(sourceName)}
        </span>
      </div>
      <div class="epi-card__meta">
        <span class="badge ${status === 'ok' ? 'badge--ok' : status === 'timeout' ? 'badge--warning' : status === 'cached' ? 'badge--cached' : status === 'skipped' ? 'badge--warning' : 'badge--error'}">${window.Utils.escapeHTML(status)}</span>
        <span>${window.Utils.escapeHTML(latency)}</span>
        <span>Updated ${window.Utils.escapeHTML(updated)}</span>
      </div>
    `;
  }

  function tableFromRecords(records, maxRows) {
    if (!Array.isArray(records) || !records.length) return '<p class="epi-empty">No tabular records available.</p>';

    const limited = records.slice(0, maxRows || 8);
    const keys = Object.keys(limited[0]).slice(0, 6);
    if (!keys.length) return '<p class="epi-empty">No tabular records available.</p>';

    const head = keys.map((key) => `<th>${window.Utils.escapeHTML(key)}</th>`).join('');
    const body = limited
      .map((row) => {
        const cells = keys
          .map((key) => `<td>${window.Utils.escapeHTML(row[key] === undefined || row[key] === null ? '--' : row[key])}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    return `
      <div class="epi-table-wrap">
        <table class="epi-table">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  function bodyForDiseaseSh(data) {
    const point = data && data.country && !data.country.error
      ? data.country
      : data && data.global && !data.global.error
        ? data.global
        : null;

    const stats = [
      { label: 'Cases', value: window.Utils.formatNumber(point && point.cases) },
      { label: 'Deaths', value: window.Utils.formatNumber(point && point.deaths) },
      { label: 'Recovered', value: window.Utils.formatNumber(point && point.recovered) },
      { label: 'Active', value: window.Utils.formatNumber(point && point.active) },
      { label: 'Cases / 1M', value: window.Utils.formatNumber(point && point.casesPerOneMillion) },
      { label: 'Deaths / 1M', value: window.Utils.formatNumber(point && point.deathsPerOneMillion) },
    ];

    const details = data && data.historical && data.historical.timeline
      ? `
          <p class="epi-detail-note">Historical timeline is available for charting (${Object.keys(data.historical.timeline.cases || {}).length} points).</p>
          ${tableFromRecords(
            Object.keys(data.historical.timeline.cases || {}).map((date) => ({
              date,
              cases: data.historical.timeline.cases[date],
              deaths: data.historical.timeline.deaths && data.historical.timeline.deaths[date],
              recovered: data.historical.timeline.recovered && data.historical.timeline.recovered[date],
            })),
            10
          )}
        `
      : '<p class="epi-empty">No historical timeline returned.</p>';

    return {
      summary: `<div class="epi-stats-grid">${kvRows(stats)}</div>`,
      details,
    };
  }

  function bodyForGeneric(data, shape) {
    if (!data) {
      return {
        summary: '<p class="epi-empty">No source payload returned for this query.</p>',
        details: '',
      };
    }

    if (shape === 'indicators') {
      const indicators = data.indicators || [];
      const stats = [
        { label: 'Indicators', value: window.Utils.formatNumber(indicators.length) },
        {
          label: 'With Records',
          value: window.Utils.formatNumber(indicators.filter((item) => item && Number(item.recordCount) > 0).length),
        },
      ];

      const records = [];
      for (const indicator of indicators) {
        const dataRows = Array.isArray(indicator.data) ? indicator.data : [];
        for (const row of dataRows.slice(0, 3)) {
          records.push({
            indicator: indicator.label || indicator.indicator,
            year: row.year,
            country: row.country,
            value: row.displayValue || row.value,
          });
        }
      }

      return {
        summary: `<div class="epi-stats-grid">${kvRows(stats)}</div>`,
        details: tableFromRecords(records, 12),
      };
    }

    if (shape === 'datasets') {
      const datasets = data.datasets || [];
      const stats = [
        { label: 'Datasets', value: window.Utils.formatNumber(datasets.length) },
        {
          label: 'Total Records',
          value: window.Utils.formatNumber(datasets.reduce((sum, set) => sum + (Number(set.recordCount) || 0), 0)),
        },
      ];
      const records = [];
      for (const dataset of datasets) {
        const dsRecords = Array.isArray(dataset.records) ? dataset.records : [];
        for (const row of dsRecords.slice(0, 3)) {
          records.push({ dataset: dataset.label || dataset.dataset, ...row });
        }
      }
      return {
        summary: `<div class="epi-stats-grid">${kvRows(stats)}</div>`,
        details: tableFromRecords(records, 12),
      };
    }

    if (shape === 'metrics') {
      const metricEntries = Object.entries(data.metrics || {});
      const stats = [
        { label: 'Metric Streams', value: window.Utils.formatNumber(metricEntries.length) },
        {
          label: 'Data Points',
          value: window.Utils.formatNumber(
            metricEntries.reduce((sum, entry) => {
              const payload = entry[1] || {};
              return sum + (Number(payload.recordCount) || 0);
            }, 0)
          ),
        },
      ];

      const records = [];
      for (const [metricKey, metricPayload] of metricEntries) {
        const rows = Array.isArray(metricPayload.records) ? metricPayload.records : [];
        for (const row of rows.slice(0, 2)) {
          records.push({ metric: metricKey, ...row });
        }
      }

      return {
        summary: `<div class="epi-stats-grid">${kvRows(stats)}</div>`,
        details: tableFromRecords(records, 10),
      };
    }

    if (shape === 'records') {
      const records = data.records || [];
      const stats = [
        { label: 'Records', value: window.Utils.formatNumber(records.length) },
        { label: 'Disease', value: data.disease || '--' },
        { label: 'Region', value: data.region || '--' },
      ];
      return {
        summary: `<div class="epi-stats-grid">${kvRows(stats)}</div>`,
        details: tableFromRecords(records, 12),
      };
    }

    const entries = Object.entries(data)
      .filter((entry) => {
        const key = entry[0];
        const value = entry[1];
        if (value === null || value === undefined) return false;
        if (typeof value === 'object') return false;
        return !['note', 'region', 'disease'].includes(key);
      })
      .slice(0, 8)
      .map((entry) => ({ label: entry[0], value: entry[1] }));

    return {
      summary: `<div class="epi-stats-grid">${kvRows(entries.length ? entries : [{ label: 'Status', value: 'Source responded' }])}</div>`,
      details: tableFromRecords([data], 1),
    };
  }

  function renderSourceCard(sourceName, sourceData, statusEntry, payloadTimestamp, index) {
    const isDiseaseSh = sourceName === 'Disease.sh';
    const shape = dataShape(sourceData);
    const body = isDiseaseSh ? bodyForDiseaseSh(sourceData) : bodyForGeneric(sourceData, shape);

    const toggleId = `epi-toggle-${index}`;
    const panelId = `epi-details-${index}`;

    return `
      <article class="card epi-card" style="animation-delay:${index * 60}ms">
        ${sourceHeader(sourceName, statusEntry, payloadTimestamp)}
        <div class="card__body">
          ${body.summary}
          <button
            type="button"
            id="${toggleId}"
            class="epi-toggle"
            data-target="${panelId}"
            aria-expanded="false"
            aria-controls="${panelId}"
          >View Details</button>
          <div class="epi-details" id="${panelId}" hidden>
            ${body.details}
          </div>
        </div>
      </article>
    `;
  }

  function render(detail) {
    if (!root) return;
    const payload = detail && detail.data;
    const epi = payload && payload.results ? payload.results.epidemiological : {};
    const statusMap = sourceStatusLookup(payload);
    const timestamp = payload && payload.timestamp;

    const cards = SOURCE_ORDER.map((sourceName, index) =>
      renderSourceCard(sourceName, epi[sourceName], statusMap.get(sourceName), timestamp, index)
    ).join('');

    root.innerHTML = cards;
  }

  function onClick(event) {
    const button = event.target.closest('.epi-toggle');
    if (!button) return;

    const targetId = button.getAttribute('data-target');
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;

    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    button.textContent = expanded ? 'View Details' : 'Hide Details';
    target.hidden = expanded;
  }

  function clear() {
    if (!root) return;
    root.innerHTML = '';
  }

  function init() {
    if (!root) return;
    root.addEventListener('click', onClick);
    window.addEventListener('search:start', clear);
    window.addEventListener('search:complete', (event) => render(event.detail));
  }

  window.EpiCardsModule = {
    init,
  };
})();
