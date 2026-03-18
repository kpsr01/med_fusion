(function () {
  'use strict';

  const GLOSSARY = {
    'ICD-10': 'International Classification of Diseases, 10th revision coding standard.',
    'ICD-11': 'Latest WHO disease classification standard used for global reporting.',
    incidence: 'Number of new cases in a population during a time period.',
    prevalence: 'Total number of existing cases in a population at a point in time.',
    DALYs: 'Disability-adjusted life years: years lost due to illness, disability, or early death.',
    tractability: 'How feasible a gene target is for developing therapeutic interventions.',
    epidemiological: 'Disease patterns across populations, regions, and time.',
  };

  let tooltipNode = null;

  function ensureTooltip() {
    if (tooltipNode) return tooltipNode;
    tooltipNode = document.createElement('div');
    tooltipNode.className = 'tooltip-pop';
    tooltipNode.hidden = true;
    tooltipNode.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltipNode);
    return tooltipNode;
  }

  function placeTooltip(target, text) {
    const tooltip = ensureTooltip();
    tooltip.textContent = text;
    tooltip.hidden = false;

    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const top = Math.max(8, rect.top - tooltipRect.height - 8);
    const left = Math.min(window.innerWidth - tooltipRect.width - 8, Math.max(8, rect.left + rect.width / 2 - tooltipRect.width / 2));

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  }

  function hideTooltip() {
    if (!tooltipNode) return;
    tooltipNode.hidden = true;
  }

  function wrapJargonText(node) {
    if (!node || !node.textContent) return;
    let html = window.Utils.escapeHTML(node.textContent);
    let changed = false;

    Object.keys(GLOSSARY).forEach((term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b(${escaped})\\b`, 'gi');
      if (regex.test(html)) {
        changed = true;
        html = html.replace(regex, `<span class="jargon-term" tabindex="0" data-jargon="$1">$1</span>`);
      }
    });

    if (changed) {
      node.innerHTML = html;
    }
  }

  function decorateJargonIn(container) {
    if (!container) return;
    const textNodes = container.querySelectorAll('p, li, td, span, h2, h3');
    textNodes.forEach((node) => {
      if (node.children && node.children.length > 0) return;
      if (node.querySelector('.jargon-term')) return;
      wrapJargonText(node);
    });
  }

  function enableCardKeyboardFocus() {
    const cards = document.querySelectorAll('.card, .source-pill, .alert-card, .quick-queries__chip, .chart-toggle');
    cards.forEach((card) => {
      if (card.tagName === 'BUTTON' || card.tagName === 'A' || card.hasAttribute('tabindex')) return;
      card.setAttribute('tabindex', '0');
    });
  }

  function ensureAriaLabels() {
    const interactive = document.querySelectorAll('button, input, select, textarea, a[href], [role="button"]');
    interactive.forEach((node) => {
      if (node.getAttribute('aria-label') || node.getAttribute('aria-labelledby')) return;
      const text = String(node.textContent || node.getAttribute('placeholder') || '').trim();
      if (text) {
        node.setAttribute('aria-label', text);
      }
    });
  }

  function bindTooltipEvents() {
    document.addEventListener('mouseenter', (event) => {
      const target = event.target.closest('.jargon-term');
      if (!target) return;
      const term = String(target.getAttribute('data-jargon') || '');
      const def = GLOSSARY[term] || GLOSSARY[term.toUpperCase()] || GLOSSARY[term.toLowerCase()];
      if (!def) return;
      placeTooltip(target, def);
    }, true);

    document.addEventListener('mouseleave', (event) => {
      const target = event.target.closest('.jargon-term');
      if (!target) return;
      hideTooltip();
    }, true);

    document.addEventListener('focusin', (event) => {
      const target = event.target.closest('.jargon-term');
      if (!target) return;
      const term = String(target.getAttribute('data-jargon') || '');
      const def = GLOSSARY[term] || GLOSSARY[term.toUpperCase()] || GLOSSARY[term.toLowerCase()];
      if (!def) return;
      placeTooltip(target, def);
    });

    document.addEventListener('focusout', (event) => {
      const target = event.target.closest('.jargon-term');
      if (!target) return;
      hideTooltip();
    });
  }

  function hydrateAccessibility() {
    decorateJargonIn(document.body);
    enableCardKeyboardFocus();
    ensureAriaLabels();
  }

  function init() {
    bindTooltipEvents();

    window.addEventListener('dashboard:ready', hydrateAccessibility);
    window.addEventListener('search:complete', () => {
      window.setTimeout(hydrateAccessibility, 60);
    });

    window.addEventListener('tab:changed', () => {
      window.setTimeout(hydrateAccessibility, 60);
    });
  }

  window.TooltipsModule = {
    init,
  };
})();
