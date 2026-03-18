(function () {
  'use strict';

  const SOURCE_META = {
    'Disease.sh': {
      description: 'Global and regional infectious disease statistics and historical timelines.',
      url: 'https://disease.sh',
    },
    'WHO GHO': {
      description: 'World Health Organization Global Health Observatory indicator datasets.',
      url: 'https://www.who.int/data/gho',
    },
    'CDC Open Data': {
      description: 'US Centers for Disease Control open surveillance and reporting datasets.',
      url: 'https://data.cdc.gov',
    },
    'CDC FluView': {
      description: 'CDC influenza surveillance stream for seasonal respiratory burden.',
      url: 'https://www.cdc.gov/flu/weekly',
    },
    HealthMap: {
      description: 'Near real-time outbreak intelligence and geotagged event alerts.',
      url: 'https://www.healthmap.org',
    },
    'ProMED Mail': {
      description: 'Expert moderated outbreak reports and infectious disease notices.',
      url: 'https://promedmail.org',
    },
    'IHME GHDx': {
      description: 'Global burden of disease records and modeled trend datasets.',
      url: 'https://ghdx.healthdata.org',
    },
    ECDC: {
      description: 'European disease surveillance indicators and response intelligence.',
      url: 'https://www.ecdc.europa.eu',
    },
    UKHSA: {
      description: 'United Kingdom Health Security Agency surveillance publications.',
      url: 'https://www.gov.uk/government/organisations/uk-health-security-agency',
    },
    'Open Targets': {
      description: 'Gene disease evidence integration with tractability insights.',
      url: 'https://platform.opentargets.org',
    },
    PubChem: {
      description: 'Compound metadata, identifiers, and therapeutic chemistry records.',
      url: 'https://pubchem.ncbi.nlm.nih.gov',
    },
    'ICD Mapping': {
      description: 'ICD-10 and ICD-11 disease coding and taxonomy mapping layer.',
      url: 'https://icd.who.int',
    },
  };

  const sourceCountBadge = document.getElementById('sourceCountBadge');
  const heroCountBadge = document.getElementById('heroSourceCount');
  const footerSources = document.getElementById('footerSources');
  const aboutBtn = document.getElementById('aboutSourcesBtn');
  const modalBackdrop = document.getElementById('aboutSourcesModal');
  const closeModalBtn = document.getElementById('closeSourcesModal');
  const modalContent = document.getElementById('aboutSourcesContent');

  let latestSources = [];
  let lastFocusedElement = null;

  function sourceStatusClass(entry) {
    if (!entry) return 'is-warning';
    if (entry.cached) return 'is-cached';
    if (entry.status === 'ok' || entry.status === 'available') return 'is-ok';
    if (entry.status === 'timeout' || entry.status === 'degraded' || entry.status === 'skipped') return 'is-warning';
    return 'is-error';
  }

  function sourceStatusLabel(entry) {
    if (!entry) return 'unknown';
    if (entry.cached) return 'cached';
    return entry.status || 'unknown';
  }

  function updateSourceCounts(count) {
    const total = Number.isFinite(Number(count)) ? Number(count) : 12;
    if (sourceCountBadge) {
      sourceCountBadge.textContent = `${total} Sources`;
      sourceCountBadge.setAttribute('aria-label', `Aggregating data from ${total} sources`);
    }
    if (heroCountBadge) {
      heroCountBadge.textContent = `Aggregating data from ${total} sources`;
    }
  }

  function applyFooterStatuses(sources) {
    if (!footerSources) return;
    const links = Array.from(footerSources.querySelectorAll('a'));
    links.forEach((link) => {
      const name = String(link.textContent || '').trim();
      const sourceEntry = Array.isArray(sources) ? sources.find((item) => item && item.name === name) : null;
      link.classList.remove('is-ok', 'is-warning', 'is-error', 'is-cached');
      link.classList.add(sourceStatusClass(sourceEntry));
      link.setAttribute('aria-label', `${name} source status ${sourceStatusLabel(sourceEntry)}`);
    });
  }

  function sourceCard(name, sourceEntry) {
    const meta = SOURCE_META[name] || {};
    const status = sourceStatusLabel(sourceEntry);
    const latency = sourceEntry && Number.isFinite(Number(sourceEntry.latency)) ? `${window.Utils.formatNumber(sourceEntry.latency)} ms` : '--';
    const color = window.Utils.SOURCE_COLORS[name] || '#9dbbe8';
    const badgeClass = status === 'ok' || status === 'available'
      ? 'badge--ok'
      : status === 'timeout' || status === 'degraded' || status === 'skipped'
        ? 'badge--warning'
        : status === 'cached'
          ? 'badge--cached'
          : 'badge--error';

    return `
      <article class="source-modal-card" style="border-color:${color}55">
        <h3>${window.Utils.escapeHTML(name)}</h3>
        <p>${window.Utils.escapeHTML(meta.description || 'No source description available.')}</p>
        <p><span class="badge ${badgeClass}">${window.Utils.escapeHTML(status)}</span> <span class="chip">${window.Utils.escapeHTML(latency)}</span></p>
        <a href="${window.Utils.escapeHTML(meta.url || '#')}" target="_blank" rel="noopener noreferrer">Open source</a>
      </article>
    `;
  }

  function renderAboutSourcesModal(sources) {
    if (!modalContent) return;
    const names = Object.keys(SOURCE_META);
    modalContent.innerHTML = names
      .map((name) => sourceCard(name, Array.isArray(sources) ? sources.find((item) => item && item.name === name) : null))
      .join('');
  }

  function openModal() {
    if (!modalBackdrop) return;
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalBackdrop.hidden = false;
    modalBackdrop.setAttribute('aria-hidden', 'false');
    if (closeModalBtn) closeModalBtn.focus();
  }

  function closeModal() {
    if (!modalBackdrop) return;
    modalBackdrop.hidden = true;
    modalBackdrop.setAttribute('aria-hidden', 'true');
    if (lastFocusedElement) lastFocusedElement.focus();
  }

  function bindModalInteractions() {
    if (aboutBtn) {
      aboutBtn.addEventListener('click', () => {
        renderAboutSourcesModal(latestSources);
        openModal();
      });
    }

    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', closeModal);
    }

    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (event) => {
        if (event.target === modalBackdrop) closeModal();
      });
    }

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modalBackdrop && !modalBackdrop.hidden) {
        closeModal();
      }
    });
  }

  function skeletonPanel(title) {
    return `
      <article class="panel-skeleton" aria-label="Loading ${window.Utils.escapeHTML(title)} panel">
        <p class="panel-skeleton__title">Loading ${window.Utils.escapeHTML(title)}</p>
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
      </article>
    `;
  }

  function renderLoadingSkeletons() {
    const targets = [
      { id: 'trendCharts', title: 'trend analysis' },
      { id: 'countryCompare', title: 'country comparison' },
      { id: 'epidemiologicalCards', title: 'source cards' },
      { id: 'outbreakTimeline', title: 'outbreak timeline' },
      { id: 'alertFeed', title: 'alert feed' },
      { id: 'classificationPanel', title: 'classification' },
      { id: 'genomicCards', title: 'genomic panel' },
      { id: 'therapeuticCards', title: 'therapeutics panel' },
      { id: 'networkGraph', title: 'network graph' },
    ];

    targets.forEach((target) => {
      const node = document.getElementById(target.id);
      if (!node) return;
      if (String(node.innerHTML || '').trim()) return;
      node.innerHTML = skeletonPanel(target.title);
    });
  }

  function renderEmptyState(containerId, title, copy) {
    const node = document.getElementById(containerId);
    if (!node) return;
    const current = String(node.innerHTML || '').trim();
    if (current && !current.includes('panel-skeleton')) return;
    node.innerHTML = `
      <article class="empty-card" aria-label="${window.Utils.escapeHTML(title)} empty state">
        <p>${window.Utils.escapeHTML(title)}</p>
        <p>${window.Utils.escapeHTML(copy)}</p>
      </article>
    `;
  }

  function applyEmptyStates(payload) {
    const results = payload && payload.results ? payload.results : {};
    const alerts = Array.isArray(results.outbreakAlerts) ? results.outbreakAlerts : [];
    const associations = results.genomicAssociations && Array.isArray(results.genomicAssociations.associations)
      ? results.genomicAssociations.associations
      : [];
    const therapeutics = Array.isArray(results.therapeutics) ? results.therapeutics : [];
    const classification = results.classification;

    if (!alerts.length) {
      renderEmptyState('outbreakTimeline', 'No outbreak timeline points', 'No alert timestamps were returned for this query window.');
      renderEmptyState('alertFeed', 'No outbreak alerts available', 'Try a broader disease or region query to surface outbreak posts.');
    }

    if (!classification || (typeof classification === 'object' && Object.keys(classification).length === 0)) {
      renderEmptyState('classificationPanel', 'No ICD mapping available', 'No exact or partial ICD matches were returned for this query.');
    }

    if (!associations.length) {
      renderEmptyState('genomicCards', 'No genomic associations returned', 'No Open Targets gene associations were available for this disease.');
      renderEmptyState('networkGraph', 'Network graph unavailable', 'Graph rendering requires at least one gene or therapeutic node.');
    }

    if (!therapeutics.length) {
      renderEmptyState('therapeuticCards', 'No therapeutics returned', 'No PubChem compounds were resolved for this query.');
    }
  }

  async function loadSourceRegistry() {
    if (!window.api || typeof window.api.getSources !== 'function') return;
    try {
      const response = await window.api.getSources({ timeoutMs: 12000 });
      const count = response && response.count;
      const sources = response && Array.isArray(response.sources) ? response.sources : [];
      latestSources = sources;
      updateSourceCounts(count || sources.length || 12);
      applyFooterStatuses(sources);
      renderAboutSourcesModal(sources);
    } catch (error) {
      updateSourceCounts(12);
      applyFooterStatuses([]);
    }
  }

  function init() {
    bindModalInteractions();

    window.addEventListener('dashboard:ready', () => {
      loadSourceRegistry();
      renderAboutSourcesModal(latestSources);
    });

    window.addEventListener('dashboard:loading-panels', () => {
      renderLoadingSkeletons();
    });

    window.addEventListener('search:complete', (event) => {
      const payload = event && event.detail ? event.detail.data : null;
      const sources = payload && Array.isArray(payload.sources) ? payload.sources : null;
      if (Array.isArray(sources) && sources.length) {
        latestSources = sources;
        applyFooterStatuses(sources);
        renderAboutSourcesModal(sources);
      }
      applyEmptyStates(payload);
    });
  }

  window.AttributionModule = {
    init,
  };
})();
