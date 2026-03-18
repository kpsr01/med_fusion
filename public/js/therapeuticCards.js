(function () {
  'use strict';

  const root = document.getElementById('therapeuticCards');

  function toArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    return [];
  }

  function compactText(text, maxLength) {
    if (!text) return '';
    const value = String(text);
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength).trim()}...`;
  }

  function renderCard(compound, index) {
    const name = compound.name || `Compound ${index + 1}`;
    const cardId = `drug-card-${String(name).replace(/[^a-z0-9_-]/gi, '').toLowerCase()}`;
    const mechanism = compound.mechanismOfAction || compound.description || '';
    const indication = compound.indication || 'No explicit indication returned.';
    const iupac = compound.iupacName || 'Not available';
    const synonyms = toArray(compound.synonyms).slice(0, 8);
    const formula = compound.molecularFormula || '--';
    const weight = compound.molecularWeight ? `${compound.molecularWeight} g/mol` : '--';
    const cid = compound.cid || '--';

    return `
      <article class="card therapeutic-card" id="${window.Utils.escapeHTML(cardId)}" data-drug-name="${window.Utils.escapeHTML(name)}">
        <div class="card__header">
          <h2 class="therapeutic-card__name">${window.Utils.escapeHTML(name)}</h2>
          <span class="badge badge--source">PubChem</span>
        </div>
        <div class="card__body">
          <div class="therapeutic-badges">
            ${compound.whoEssentialMedicine ? '<span class="badge badge--ok">WHO Essential Medicine</span>' : ''}
            <span class="badge badge--cached">CID ${window.Utils.escapeHTML(cid)}</span>
          </div>
          <p class="therapeutic-card__meta"><strong>Indication:</strong> ${window.Utils.escapeHTML(compactText(indication, 220))}</p>
          <p class="therapeutic-card__meta"><strong>Mechanism:</strong> ${window.Utils.escapeHTML(compactText(mechanism, 260) || 'Not available')}</p>
          <div class="therapeutic-grid">
            <p><strong>Formula:</strong> ${window.Utils.escapeHTML(formula)}</p>
            <p><strong>Weight:</strong> ${window.Utils.escapeHTML(weight)}</p>
          </div>
          <details class="therapeutic-details">
            <summary>Show IUPAC name</summary>
            <p>${window.Utils.escapeHTML(iupac)}</p>
          </details>
          <div class="classification-cloud">
            ${synonyms.length ? synonyms.map((syn) => `<span class="chip">${window.Utils.escapeHTML(syn)}</span>`).join('') : '<span class="chip">No synonyms</span>'}
          </div>
          ${compound.pubchemUrl ? `<p class="therapeutic-link"><a href="${window.Utils.escapeHTML(compound.pubchemUrl)}" target="_blank" rel="noopener noreferrer">Open PubChem compound page</a></p>` : ''}
        </div>
      </article>
    `;
  }

  function normalizeTherapeutics(payload) {
    const therapeutics = payload && payload.results && Array.isArray(payload.results.therapeutics) ? payload.results.therapeutics : [];
    return therapeutics
      .filter((item) => item && item.name)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  function render(payload) {
    if (!root) return;
    const therapeutics = normalizeTherapeutics(payload);
    if (!therapeutics.length) {
      root.innerHTML = '';
      return;
    }

    root.innerHTML = therapeutics.map((compound, index) => renderCard(compound, index)).join('');
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

    window.addEventListener('network:focus-drug', (event) => {
      const name = event && event.detail ? event.detail.name : null;
      if (!name) return;
      const cards = root.querySelectorAll('[data-drug-name]');
      cards.forEach((node) => {
        const active = String(node.getAttribute('data-drug-name') || '').toLowerCase() === String(name).toLowerCase();
        node.classList.toggle('is-focused', active);
        if (active) node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  window.TherapeuticCardsModule = {
    init,
  };
})();
