(function () {
  'use strict';

  const root = document.getElementById('alertFeed');
  const alertsCountNode = document.getElementById('alertsCount');

  const DATE_PRESETS = [
    { value: 'all', label: 'All time' },
    { value: '7', label: '7d' },
    { value: '30', label: '30d' },
    { value: '90', label: '90d' },
  ];

  let allAlerts = [];
  let sourceFilter = 'all';
  let dateFilter = 'all';

  function parseDateValue(value) {
    if (!value) return null;
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) return direct;

    const parsed = Date.parse(String(value).replace(/\s+/g, ' '));
    if (!Number.isNaN(parsed)) return new Date(parsed);
    return null;
  }

  function severityOf(alert) {
    const text = `${alert.title || ''} ${alert.summary || ''}`.toLowerCase();
    if (text.includes('death') || text.includes('fatal') || text.includes('emergency') || text.includes('outbreak')) return 'high';
    if (text.includes('cluster') || text.includes('spike') || text.includes('warning')) return 'medium';
    return 'low';
  }

  function normalizeAlerts(payload) {
    const raw = payload && payload.results && Array.isArray(payload.results.outbreakAlerts) ? payload.results.outbreakAlerts : [];
    const flat = [];

    raw.forEach((entry) => {
      if (!entry) return;

      if (Array.isArray(entry.posts)) {
        entry.posts.forEach((post) => {
          flat.push({
            source: entry.source || 'ProMED Mail',
            title: post.title || 'ProMED post',
            url: post.link || null,
            dateRaw: post.date || null,
            location: payload && payload.query ? payload.query.region : null,
            summary: post.excerpt || entry.note || null,
          });
        });
        return;
      }

      flat.push({
        source: entry.source || 'HealthMap',
        title: entry.title || 'Untitled alert',
        url: entry.link || entry.url || null,
        dateRaw: entry.date || entry.pubDate || null,
        location: entry.location || entry.region || entry.country || null,
        summary: entry.summary || entry.excerpt || entry.note || null,
      });
    });

    return flat
      .map((alert) => {
        const dateObj = parseDateValue(alert.dateRaw);
        return {
          ...alert,
          dateObj,
          severity: severityOf(alert),
        };
      })
      .sort((a, b) => {
        const at = a.dateObj ? a.dateObj.getTime() : 0;
        const bt = b.dateObj ? b.dateObj.getTime() : 0;
        return bt - at;
      });
  }

  function updateCountBadge(count) {
    if (!alertsCountNode) return;
    alertsCountNode.textContent = String(count);
  }

  function sourceClass(source) {
    const text = String(source || '').toLowerCase();
    return text.includes('promed') ? 'badge--cached' : 'badge--error';
  }

  function severityClass(severity) {
    if (severity === 'high') return 'badge--error';
    if (severity === 'medium') return 'badge--warning';
    return 'badge--ok';
  }

  function filteredAlerts() {
    let rows = allAlerts.slice();

    if (sourceFilter !== 'all') {
      rows = rows.filter((alert) => String(alert.source || '').toLowerCase().includes(sourceFilter));
    }

    if (dateFilter !== 'all') {
      const days = Number(dateFilter);
      if (Number.isFinite(days) && days > 0) {
        const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
        rows = rows.filter((alert) => (alert.dateObj ? alert.dateObj.getTime() >= threshold : false));
      }
    }

    return rows;
  }

  function controlsMarkup() {
    const dateButtons = DATE_PRESETS.map((preset) => {
      const active = preset.value === dateFilter ? ' is-active' : '';
      return `<button type="button" class="chart-toggle${active}" data-alert-date="${preset.value}">${preset.label}</button>`;
    }).join('');

    return `
      <div class="alert-controls">
        <div class="chart-toolbar__group" role="tablist" aria-label="Source filters">
          <button type="button" class="chart-toggle${sourceFilter === 'all' ? ' is-active' : ''}" data-alert-source="all">All Sources</button>
          <button type="button" class="chart-toggle${sourceFilter === 'healthmap' ? ' is-active' : ''}" data-alert-source="healthmap">HealthMap</button>
          <button type="button" class="chart-toggle${sourceFilter === 'promed' ? ' is-active' : ''}" data-alert-source="promed">ProMED</button>
        </div>
        <div class="chart-toolbar__group" role="tablist" aria-label="Date filters">
          ${dateButtons}
        </div>
      </div>
    `;
  }

  function cardMarkup(alert) {
    const dateText = alert.dateObj ? alert.dateObj.toLocaleString() : 'Date unavailable';
    const timeAgo = alert.dateObj ? window.Utils.timeAgo(alert.dateObj) : '--';

    return `
      <article class="alert-card">
        <div class="alert-card__top">
          <span class="badge ${sourceClass(alert.source)}">${window.Utils.escapeHTML(alert.source || 'Unknown source')}</span>
          <span class="badge ${severityClass(alert.severity)}">${window.Utils.escapeHTML(alert.severity)} severity</span>
        </div>
        <h3 class="alert-card__title">
          ${alert.url ? `<a href="${window.Utils.escapeHTML(alert.url)}" target="_blank" rel="noopener noreferrer">${window.Utils.escapeHTML(alert.title || 'Untitled alert')}</a>` : window.Utils.escapeHTML(alert.title || 'Untitled alert')}
        </h3>
        <p class="alert-card__meta">${window.Utils.escapeHTML(dateText)} (${window.Utils.escapeHTML(timeAgo)})</p>
        <p class="alert-card__meta">${window.Utils.escapeHTML(alert.location || 'Location not specified')}</p>
        ${alert.summary ? `<p class="alert-card__summary">${window.Utils.escapeHTML(alert.summary)}</p>` : ''}
      </article>
    `;
  }

  function render() {
    if (!root) return;

    const rows = filteredAlerts();
    updateCountBadge(rows.length);

    const listHtml = rows.length
      ? rows.map((alert) => cardMarkup(alert)).join('')
      : '<p class="chart-empty">No alerts match the current filters for this query.</p>';

    root.innerHTML = `
      <article class="card">
        <div class="card__header">
          <h2>Outbreak Alert Feed</h2>
          <span class="badge badge--source">HealthMap + ProMED</span>
        </div>
        <div class="card__body">
          ${controlsMarkup()}
          <div class="alert-feed-list">${listHtml}</div>
        </div>
      </article>
    `;
  }

  function onClick(event) {
    const sourceButton = event.target.closest('[data-alert-source]');
    if (sourceButton) {
      sourceFilter = sourceButton.getAttribute('data-alert-source') || 'all';
      render();
      window.dispatchEvent(new CustomEvent('alerts:filters-changed', { detail: { sourceFilter, dateFilter } }));
      return;
    }

    const dateButton = event.target.closest('[data-alert-date]');
    if (dateButton) {
      dateFilter = dateButton.getAttribute('data-alert-date') || 'all';
      render();
      window.dispatchEvent(new CustomEvent('alerts:filters-changed', { detail: { sourceFilter, dateFilter } }));
    }
  }

  function init() {
    if (!root) return;

    root.addEventListener('click', onClick);

    window.addEventListener('search:start', () => {
      allAlerts = [];
      sourceFilter = 'all';
      dateFilter = 'all';
      updateCountBadge(0);
      root.innerHTML = '';
    });

    window.addEventListener('search:complete', (event) => {
      const payload = event && event.detail ? event.detail.data : null;
      allAlerts = normalizeAlerts(payload);
      sourceFilter = 'all';
      dateFilter = 'all';
      render();
      window.dispatchEvent(new CustomEvent('alerts:normalized', { detail: { alerts: allAlerts.slice() } }));
    });
  }

  window.AlertFeedModule = {
    init,
  };
})();
