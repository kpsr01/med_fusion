(function () {
  'use strict';

  const TAB_IDS = ['overview', 'epidemiological', 'alerts', 'classification', 'genomic', 'therapeutics'];
  const tabButtons = Array.from(document.querySelectorAll('.tab-nav__btn'));
  const panels = Array.from(document.querySelectorAll('[data-panel]'));
  const headerStatus = document.getElementById('headerStatus');
  const statusText = document.getElementById('statusText');

  const MODULE_ORDER = [
    'SearchModule',
    'SourceStatusModule',
    'OverviewModule',
    'TrendSummaryModule',
    'MapModule',
    'MapChoroplethModule',
    'MapAlertsModule',
    'TrendChartsModule',
    'CountryCompareModule',
    'EpiCardsModule',
    'AlertFeedModule',
    'OutbreakTimelineModule',
    'ClassificationModule',
    'GenomicCardsModule',
    'TherapeuticCardsModule',
    'NetworkGraphModule',
    'AttributionModule',
    'TooltipsModule',
  ];

  function setActiveTab(tabId) {
    tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === tabId;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.panel === tabId;
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
    });

    window.dispatchEvent(new CustomEvent('tab:changed', { detail: { tabId } }));

    if (tabId === 'epidemiological' && window.__cbMap && window.__cbMap.map) {
      window.setTimeout(() => {
        if (window.__cbMap && window.__cbMap.map) {
          window.__cbMap.map.invalidateSize(true);
        }
      }, 120);
    }
  }

  function bindTabs() {
    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tabId = button.dataset.tab;
        if (!TAB_IDS.includes(tabId)) return;
        setActiveTab(tabId);
      });

      button.addEventListener('keydown', (event) => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const current = tabButtons.indexOf(button);
        if (current < 0) return;

        let nextIndex = current;
        if (event.key === 'ArrowRight') nextIndex = (current + 1) % tabButtons.length;
        if (event.key === 'ArrowLeft') nextIndex = (current - 1 + tabButtons.length) % tabButtons.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabButtons.length - 1;

        const nextButton = tabButtons[nextIndex];
        if (!nextButton) return;
        nextButton.focus();
        setActiveTab(nextButton.dataset.tab);
      });
    });
  }

  function setHealthState(ok, text) {
    headerStatus.classList.toggle('status-pill--ok', ok);
    headerStatus.classList.toggle('status-pill--error', !ok);
    headerStatus.classList.remove('status-pill--warning');
    statusText.textContent = text;
  }

  async function initHealth() {
    try {
      await window.api.healthCheck({ timeoutMs: 8000 });
      setHealthState(true, 'Systems online');
    } catch (error) {
      setHealthState(false, 'System check failed');
    }
  }

  function initModules() {
    MODULE_ORDER.forEach((name) => {
      const moduleRef = window[name];
      if (moduleRef && typeof moduleRef.init === 'function') {
        moduleRef.init();
      }
    });
  }

  function init() {
    bindTabs();
    setActiveTab('overview');
    initModules();
    initHealth();

    window.dispatchEvent(new CustomEvent('dashboard:ready', {
      detail: {
        tabs: TAB_IDS.slice(),
      },
    }));
  }

  init();
})();
