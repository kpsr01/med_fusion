(function () {
  'use strict';

  const root = document.getElementById('genomicCards');

  function numericScore(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function evidenceRows(evidenceScores) {
    const entries = Object.entries(evidenceScores || {})
      .map(([key, score]) => ({ key, score: numericScore(score) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (!entries.length) {
      return '<p class="chart-empty">No evidence breakdown provided.</p>';
    }

    return entries
      .map((entry) => {
        const pct = Math.max(0, Math.min(100, Math.round(entry.score * 100)));
        return `
          <div class="evidence-row">
            <div class="evidence-row__meta">
              <span>${window.Utils.escapeHTML(entry.key)}</span>
              <span>${pct}%</span>
            </div>
            <div class="evidence-row__bar"><span style="width:${pct}%"></span></div>
          </div>
        `;
      })
      .join('');
  }

  function tractabilityLabel(score) {
    if (score >= 0.8) return 'High tractability';
    if (score >= 0.55) return 'Moderate tractability';
    if (score >= 0.3) return 'Early signal';
    return 'Exploratory';
  }

  function card(association, index) {
    const score = numericScore(association.overallScore);
    const pct = Math.max(0, Math.min(100, Math.round(score * 100)));
    const symbol = association.geneSymbol || association.targetId || 'N/A';
    const cardId = `gene-card-${String(symbol).replace(/[^a-z0-9_-]/gi, '').toLowerCase() || index}`;

    return `
      <article class="card genomic-card" id="${window.Utils.escapeHTML(cardId)}" data-gene-symbol="${window.Utils.escapeHTML(symbol)}">
        <div class="card__header">
          <h2 class="genomic-card__symbol">${window.Utils.escapeHTML(symbol)}</h2>
          <span class="badge badge--source">Open Targets</span>
        </div>
        <div class="card__body">
          <p class="genomic-card__name">${window.Utils.escapeHTML(association.geneName || 'Unknown gene')}</p>
          <div class="score-gauge" aria-label="Overall association score ${pct} percent">
            <div class="score-gauge__meta">
              <span>Association score</span>
              <strong>${pct}%</strong>
            </div>
            <div class="score-gauge__bar"><span style="width:${pct}%"></span></div>
          </div>
          <p class="genomic-card__tractability">${window.Utils.escapeHTML(tractabilityLabel(score))}</p>
          <div class="evidence-block">
            <p class="classification-mini-title">Evidence breakdown</p>
            ${evidenceRows(association.evidenceScores)}
          </div>
        </div>
      </article>
    `;
  }

  function render(payload) {
    if (!root) return;
    const results = payload && payload.results ? payload.results : {};
    const associationsRaw = results.genomicAssociations && Array.isArray(results.genomicAssociations.associations)
      ? results.genomicAssociations.associations
      : [];

    const associations = associationsRaw
      .slice()
      .sort((a, b) => numericScore(b.overallScore) - numericScore(a.overallScore));

    if (!associations.length) {
      root.innerHTML = '';
      return;
    }

    root.innerHTML = associations.map((assoc, idx) => card(assoc, idx)).join('');
  }

  function init() {
    if (!root) return;

    window.addEventListener('search:start', () => {
      root.innerHTML = '';
    });

    window.addEventListener('search:complete', (event) => {
      const payload = event && event.detail ? event.detail.data : null;
      render(payload);
    });

    window.addEventListener('network:focus-gene', (event) => {
      const symbol = event && event.detail ? event.detail.symbol : null;
      if (!symbol) return;
      const cards = root.querySelectorAll('[data-gene-symbol]');
      cards.forEach((node) => {
        const active = String(node.getAttribute('data-gene-symbol') || '').toLowerCase() === String(symbol).toLowerCase();
        node.classList.toggle('is-focused', active);
        if (active) node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  window.GenomicCardsModule = {
    init,
  };
})();
