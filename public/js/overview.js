(function () {
  'use strict';

  const root = document.getElementById('overviewCards');

  function chooseTrend(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) {
      return { direction: 'flat', label: 'No trend data', arrow: '—' };
    }

    if (current > previous) {
      return { direction: 'up', label: `+${window.Utils.formatNumber(current - previous)} vs prior`, arrow: '▲' };
    }

    if (current < previous) {
      return { direction: 'down', label: `-${window.Utils.formatNumber(previous - current)} vs prior`, arrow: '▼' };
    }

    return { direction: 'flat', label: 'Flat trend', arrow: '—' };
  }

  function trendFromDiseaseSh(metricName, diseaseSh) {
    const timeline = diseaseSh && diseaseSh.historical && diseaseSh.historical.timeline;
    const metric = timeline && timeline[metricName];
    if (!metric) return { direction: 'flat', label: 'No historical trend', arrow: '—' };

    const values = Object.values(metric).map((n) => Number(n)).filter(Number.isFinite);
    if (values.length < 2) return { direction: 'flat', label: 'Limited timeline', arrow: '—' };

    return chooseTrend(values[values.length - 1], values[values.length - 2]);
  }

  function statCard(title, value, sourceName, trend) {
    return `
      <article class="card stat-card" role="article" aria-label="${window.Utils.escapeHTML(title)} card">
        <div class="card__header">
          <h2>${window.Utils.escapeHTML(title)}</h2>
          <span class="badge badge--source">via ${window.Utils.escapeHTML(sourceName)}</span>
        </div>
        <div class="card__body">
          <p class="stat-card__value">${window.Utils.formatNumber(value)}</p>
          <p class="stat-card__label">Current aggregated signal</p>
        </div>
        <div class="card__footer">
          <span class="trend-chip trend-chip--${window.Utils.escapeHTML(trend.direction)}">${window.Utils.escapeHTML(trend.arrow)} ${window.Utils.escapeHTML(trend.label)}</span>
        </div>
      </article>
    `;
  }

  function getCards(payload) {
    const results = payload && payload.results ? payload.results : {};
    const epi = results.epidemiological || {};
    const diseaseSh = epi['Disease.sh'] || {};

    const point = diseaseSh.country && !diseaseSh.country.error ? diseaseSh.country : diseaseSh.global && !diseaseSh.global.error ? diseaseSh.global : null;

    const outbreakAlerts = Array.isArray(results.outbreakAlerts) ? results.outbreakAlerts : [];
    const associations =
      results.genomicAssociations && Array.isArray(results.genomicAssociations.associations)
        ? results.genomicAssociations.associations
        : [];
    const therapeutics = Array.isArray(results.therapeutics) ? results.therapeutics : [];

    return [
      {
        title: 'Total Cases',
        value: point && Number.isFinite(point.cases) ? point.cases : null,
        source: 'Disease.sh',
        trend: trendFromDiseaseSh('cases', diseaseSh),
      },
      {
        title: 'Total Deaths',
        value: point && Number.isFinite(point.deaths) ? point.deaths : null,
        source: 'Disease.sh',
        trend: trendFromDiseaseSh('deaths', diseaseSh),
      },
      {
        title: 'Recovered',
        value: point && Number.isFinite(point.recovered) ? point.recovered : null,
        source: 'Disease.sh',
        trend: trendFromDiseaseSh('recovered', diseaseSh),
      },
      {
        title: 'Active Outbreaks',
        value: outbreakAlerts.length,
        source: 'HealthMap + ProMED Mail',
        trend: { direction: 'flat', label: 'Live outbreak feed', arrow: '—' },
      },
      {
        title: 'Gene Associations',
        value: associations.length,
        source: 'Open Targets',
        trend: { direction: 'flat', label: 'Top-target enrichment', arrow: '—' },
      },
      {
        title: 'Therapeutics',
        value: therapeutics.length,
        source: 'PubChem',
        trend: { direction: 'flat', label: 'Compound resolution', arrow: '—' },
      },
    ];
  }

  function render(eventDetail) {
    if (!root) return;
    const payload = eventDetail && eventDetail.data;
    if (!payload) return;

    const cards = getCards(payload)
      .map((card) => statCard(card.title, card.value, card.source, card.trend))
      .join('');

    root.innerHTML = cards;
  }

  function clearLoading() {
    if (!root) return;
    root.innerHTML = '';
  }

  function init() {
    window.addEventListener('search:start', clearLoading);
    window.addEventListener('search:complete', (event) => {
      render(event.detail);
    });
  }

  window.OverviewModule = {
    init,
  };
})();
