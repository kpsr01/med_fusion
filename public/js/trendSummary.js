(function () {
  'use strict';

  const root = document.getElementById('trendSummary');

  function metricTone(metric) {
    const name = String(metric || '').toLowerCase();
    if (name.includes('death') || name.includes('case') || name.includes('outbreak')) {
      return 'burden';
    }
    if (name.includes('recover')) {
      return 'recovery';
    }
    return 'neutral';
  }

  function directionVisual(direction, tone) {
    if (direction === 'increasing') {
      if (tone === 'burden') {
        return { chip: 'trend-chip--up', label: 'Rising burden', symbol: '▲' };
      }
      return { chip: 'trend-chip--down', label: 'Improving upward', symbol: '▲' };
    }

    if (direction === 'decreasing') {
      if (tone === 'burden') {
        return { chip: 'trend-chip--down', label: 'Burden easing', symbol: '▼' };
      }
      return { chip: 'trend-chip--up', label: 'Recovery softening', symbol: '▼' };
    }

    return { chip: 'trend-chip--flat', label: 'Stable', symbol: '—' };
  }

  function row(label, value) {
    return `
      <div class="trend-card__stat">
        <p>${window.Utils.escapeHTML(label)}</p>
        <p>${window.Utils.escapeHTML(value)}</p>
      </div>
    `;
  }

  function card(trendKey, trend) {
    const tone = metricTone(trend.metric);
    const visual = directionVisual(trend.trendDirection, tone);

    const wow =
      trend.weekOverWeekChange !== undefined && trend.weekOverWeekChange !== null
        ? `${trend.weekOverWeekChange > 0 ? '+' : ''}${trend.weekOverWeekChange}%`
        : '--';

    const totalChange =
      trend.totalChange !== undefined && trend.totalChange !== null
        ? window.Utils.formatNumber(trend.totalChange)
        : '--';

    return `
      <article class="card trend-card" aria-label="Trend summary ${window.Utils.escapeHTML(trendKey)}">
        <div class="card__header">
          <h2 class="trend-card__metric">${window.Utils.escapeHTML(trend.metric || trendKey)}</h2>
          <span class="badge badge--source">${window.Utils.escapeHTML(trend.source || 'Unknown source')}</span>
        </div>
        <div class="card__body">
          <p class="trend-card__period">${window.Utils.escapeHTML(trend.period || '--')}</p>
          <div class="trend-card__grid">
            ${row('Data points', window.Utils.formatNumber(trend.dataPoints))}
            ${row('Total change', totalChange)}
            ${row('WoW %', wow)}
            ${row('Direction', `${visual.symbol} ${visual.label}`)}
          </div>
        </div>
        <div class="card__footer">
          <span class="trend-chip ${visual.chip}">${window.Utils.escapeHTML(visual.symbol)} ${window.Utils.escapeHTML(visual.label)}</span>
        </div>
      </article>
    `;
  }

  function render(eventDetail) {
    if (!root) return;
    const payload = eventDetail && eventDetail.data ? eventDetail.data : null;
    const trends = payload && payload.results ? payload.results.trendAnalysis : null;

    if (!trends || typeof trends !== 'object') {
      root.innerHTML = '';
      return;
    }

    const cards = Object.entries(trends)
      .map(([key, trend]) => card(key, trend))
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

  window.TrendSummaryModule = {
    init,
  };
})();
