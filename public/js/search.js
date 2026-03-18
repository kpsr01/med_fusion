(function () {
  'use strict';

  const STORAGE_KEY = 'cbhack:lastQuery:v1';

  const searchForm = document.getElementById('searchForm');
  const diseaseInput = document.getElementById('diseaseInput');
  const regionInput = document.getElementById('regionInput');
  const quickQueryRoot = document.getElementById('quickQueryHints');
  const heroQuickQueryRoot = document.querySelector('[data-quick-query-root]');
  const searchFeedback = document.getElementById('searchFeedback');
  const overviewEmptyState = document.getElementById('overviewEmptyState');

  let lastAttempt = null;
  let inFlight = false;

  function readLastQuery() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.disease) return null;
      return {
        disease: String(parsed.disease),
        region: parsed.region ? String(parsed.region) : '',
      };
    } catch {
      return null;
    }
  }

  function writeLastQuery(disease, region) {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          disease,
          region,
          savedAt: new Date().toISOString(),
        })
      );
    } catch {
      // no-op
    }
  }

  function renderLoading(disease, region) {
    if (!searchFeedback) return;
    searchFeedback.hidden = false;
    searchFeedback.className = 'search-feedback search-feedback--loading';
    searchFeedback.innerHTML = `
      <p class="search-feedback__line">Querying sources for ${window.Utils.escapeHTML(disease)}${region ? ` in ${window.Utils.escapeHTML(region)}` : ''}...</p>
      <p class="search-feedback__line">Aggregating epidemiological, outbreak, classification, genomic, and therapeutics signals.</p>
      <p class="search-feedback__line"><strong>Progressive render:</strong> panels hydrate as source responses arrive.</p>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
    `;
  }

  function renderError(errorMessage) {
    if (!searchFeedback) return;
    searchFeedback.hidden = false;
    searchFeedback.className = 'search-feedback search-feedback--error';
    searchFeedback.innerHTML = `
      <p class="search-feedback__line">Search request failed.</p>
      <p class="search-feedback__line">${window.Utils.escapeHTML(errorMessage || 'Unknown error')}</p>
      <button type="button" class="retry-btn" id="retrySearchBtn">Retry Query</button>
    `;

    const retryBtn = document.getElementById('retrySearchBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        if (!lastAttempt) return;
        runSearch(lastAttempt.disease, lastAttempt.region);
      });
    }
  }

  function renderSuccess(disease, region, latency) {
    if (!searchFeedback) return;
    searchFeedback.hidden = false;
    searchFeedback.className = 'search-feedback';
    searchFeedback.innerHTML = `
      <p class="search-feedback__line">Query complete: ${window.Utils.escapeHTML(disease)}${region ? ` in ${window.Utils.escapeHTML(region)}` : ''}</p>
      <p class="search-feedback__line">Unified response received in ${window.Utils.formatNumber(latency)} ms.</p>
    `;
  }

  async function runSearch(disease, region) {
    if (inFlight) return;
    if (!disease) return;

    inFlight = true;
    lastAttempt = { disease, region: region || '' };
    writeLastQuery(disease, region || '');
    renderLoading(disease, region || '');
    window.dispatchEvent(new CustomEvent('dashboard:loading-panels', { detail: { disease, region: region || '' } }));

    try {
      const response = await window.api.search(disease, region || '', { timeoutMs: 25000 });
      renderSuccess(disease, region || '', response && response.totalLatency);
      if (overviewEmptyState) {
        overviewEmptyState.hidden = true;
      }

      const dashboardMain = document.getElementById('dashboardMain');
      if (dashboardMain) {
        dashboardMain.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (error) {
      renderError(error && error.message);
    } finally {
      inFlight = false;
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    const disease = diseaseInput && diseaseInput.value ? diseaseInput.value.trim() : '';
    const region = regionInput && regionInput.value ? regionInput.value.trim() : '';
    runSearch(disease, region);
  }

  function bindQuickQueryRoot(rootNode) {
    if (!rootNode) return;
    rootNode.addEventListener('click', (event) => {
      const button = event.target.closest('[data-disease]');
      if (!button) return;

      const disease = button.getAttribute('data-disease') || '';
      const region = button.getAttribute('data-region') || '';

      if (diseaseInput) diseaseInput.value = disease;
      if (regionInput) regionInput.value = region;

      runSearch(disease, region);
    });
  }

  function bindQuickQueries() {
    bindQuickQueryRoot(quickQueryRoot);
    bindQuickQueryRoot(heroQuickQueryRoot);
  }

  function restoreLastQuery() {
    const last = readLastQuery();
    if (!last) return;

    if (diseaseInput) diseaseInput.value = last.disease;
    if (regionInput) regionInput.value = last.region;

    runSearch(last.disease, last.region);
  }

  function init() {
    if (!searchForm) return;
    searchForm.addEventListener('submit', onSubmit);
    bindQuickQueries();
    restoreLastQuery();
  }

  window.SearchModule = {
    init,
    runSearch,
  };
})();
