(function () {
  'use strict';

  const queryMetaRoot = document.getElementById('queryMeta');
  const sourceStatusRoot = document.getElementById('sourceStatus');

  const SOURCE_DESCRIPTIONS = {
    'Disease.sh': 'COVID-19 global, country, and historical metrics.',
    'WHO GHO': 'WHO Global Health Observatory indicator datasets.',
    'CDC Open Data': 'CDC surveillance datasets exposed through SODA APIs.',
    'CDC FluView': 'Influenza surveillance bulletins from CDC FluView.',
    HealthMap: 'Near real-time outbreak signals from HealthMap.',
    'ProMED Mail': 'Expert-moderated outbreak alerts from ProMED posts.',
    'IHME GHDx': 'Disease burden records from IHME GHDx datasets.',
    ECDC: 'European Centre for Disease Prevention and Control data.',
    UKHSA: 'UK Health Security Agency surveillance publications.',
    'Open Targets': 'Gene-disease association evidence from Open Targets.',
    PubChem: 'Compound and therapeutic chemistry intelligence from PubChem.',
    'ICD Mapping': 'Static ICD-10/ICD-11 classification mappings.',
  };

  function statusBadgeClass(source) {
    if (source && source.cached) return 'badge--cached';
    if (!source) return 'badge--warning';
    if (source.status === 'ok') return 'badge--ok';
    if (source.status === 'timeout') return 'badge--warning';
    return 'badge--error';
  }

  function statusLabel(source) {
    if (source && source.cached) return 'cached';
    if (!source) return 'unknown';
    return source.status || 'unknown';
  }

  function renderMeta(detail) {
    if (!queryMetaRoot) return;
    const payload = detail && detail.data ? detail.data : null;
    if (!payload) return;

    const query = payload.query || {};
    const summary = payload.summary || {};

    queryMetaRoot.innerHTML = `
      <article class="meta-banner">
        <div class="meta-banner__head">
          <div>
            <h2 class="meta-banner__title">${window.Utils.escapeHTML(query.disease || detail.disease || 'Unknown disease')} surveillance snapshot</h2>
            <p class="meta-banner__subtitle">${query.region ? `Region focus: ${window.Utils.escapeHTML(query.region)}` : 'Region focus: global'} · ${window.Utils.timeAgo(payload.timestamp)}</p>
          </div>
          <span class="badge badge--source">Latency ${window.Utils.formatNumber(payload.totalLatency)} ms</span>
        </div>
        <div class="meta-banner__stats">
          <div class="meta-stat">
            <p class="meta-stat__label">Sources Queried</p>
            <p class="meta-stat__value">${window.Utils.formatNumber(summary.totalSources)}</p>
          </div>
          <div class="meta-stat">
            <p class="meta-stat__label">Successful</p>
            <p class="meta-stat__value">${window.Utils.formatNumber(summary.successful)}</p>
          </div>
          <div class="meta-stat">
            <p class="meta-stat__label">Cached</p>
            <p class="meta-stat__value">${window.Utils.formatNumber(summary.cachedResponses)}</p>
          </div>
          <div class="meta-stat">
            <p class="meta-stat__label">Unavailable</p>
            <p class="meta-stat__value">${window.Utils.formatNumber(summary.failed)}</p>
          </div>
        </div>
      </article>
    `;
  }

  function renderSourceGrid(detail) {
    if (!sourceStatusRoot) return;

    const payload = detail && detail.data ? detail.data : null;
    const sources = payload && Array.isArray(payload.sources) ? payload.sources : [];

    if (sources.length === 0) {
      sourceStatusRoot.innerHTML = '';
      return;
    }

    const cards = sources
      .map((source, index) => {
        const pillStatus = source.cached ? 'cached' : source.status;
        const tooltipText = `${source.name}: ${SOURCE_DESCRIPTIONS[source.name] || 'Source connector response.'}${source.message ? ` Note: ${source.message}` : ''}`;
        return `
          <article
            class="source-pill"
            data-status="${window.Utils.escapeHTML(pillStatus || 'unknown')}"
            title="${window.Utils.escapeHTML(tooltipText)}"
            style="animation-delay:${index * 55}ms"
          >
            <div class="source-pill__top">
              <p class="source-pill__name">${window.Utils.escapeHTML(source.name || 'Unknown')}</p>
              <span class="source-dot" aria-hidden="true"></span>
            </div>
            <p class="source-pill__meta">${window.Utils.formatNumber(source.latency)} ms</p>
            <span class="badge ${statusBadgeClass(source)}">${window.Utils.escapeHTML(statusLabel(source))}</span>
          </article>
        `;
      })
      .join('');

    const noDataSources = sources
      .filter((source) => source && (source.status === 'timeout' || source.status === 'error' || source.status === 'skipped'))
      .map((source) => `<span class="badge badge--warning">No data from ${window.Utils.escapeHTML(source.name || 'Unknown source')}</span>`)
      .join('');

    sourceStatusRoot.innerHTML = `
      <section class="source-status-grid">${cards}</section>
      ${noDataSources ? `<section class="source-status-empty">${noDataSources}</section>` : ''}
    `;
  }

  function clearForLoading() {
    if (queryMetaRoot) {
      queryMetaRoot.innerHTML = '<article class="panel-skeleton"><p class="panel-skeleton__title">Loading query metadata</p><div class="skeleton-row"></div><div class="skeleton-row"></div></article>';
    }
    if (sourceStatusRoot) {
      sourceStatusRoot.innerHTML = '<article class="panel-skeleton"><p class="panel-skeleton__title">Loading source statuses</p><div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div></article>';
    }
  }

  function init() {
    window.addEventListener('search:start', clearForLoading);
    window.addEventListener('search:complete', (event) => {
      renderMeta(event.detail);
      renderSourceGrid(event.detail);
    });
  }

  window.SourceStatusModule = {
    init,
  };
})();
