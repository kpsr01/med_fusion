(function () {
  'use strict';

  const root = document.getElementById('classificationPanel');

  function splitCategory(category) {
    const raw = String(category || 'Uncategorized');
    const parts = raw.split(' - ').map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) {
      const alt = raw.split(' — ').map((part) => part.trim()).filter(Boolean);
      if (alt.length >= 2) return alt;
    }
    return parts.length ? parts : [raw];
  }

  function aliasesFromQuery(payload) {
    const aliases = payload && payload.query && Array.isArray(payload.query.aliases) ? payload.query.aliases : [];
    return aliases.slice(0, 10);
  }

  function renderExact(classification, payload) {
    const breadcrumbs = splitCategory(classification.category || 'Infectious diseases');
    const related = Array.isArray(classification.relatedCodes) ? classification.relatedCodes : [];
    const aliasTags = aliasesFromQuery(payload)
      .map((alias) => `<span class="chip">${window.Utils.escapeHTML(alias)}</span>`)
      .join('');

    const relatedRows = related.length
      ? related
          .map((item) => `
            <tr>
              <td><span class="badge badge--cached">${window.Utils.escapeHTML(item.code || '--')}</span></td>
              <td>${window.Utils.escapeHTML(item.description || '--')}</td>
            </tr>
          `)
          .join('')
      : '<tr><td colspan="2">No related codes available.</td></tr>';

    return `
      <article class="card">
        <div class="card__header">
          <h2>ICD Classification Browser</h2>
          <span class="badge badge--source">ICD Mapping (Static)</span>
        </div>
        <div class="card__body classification-grid">
          <section class="classification-main">
            <p class="classification-name">${window.Utils.escapeHTML(classification.name || 'Unknown disease')}</p>
            <p class="classification-desc">${window.Utils.escapeHTML(classification.description || '--')}</p>
            <div class="classification-codes">
              <span class="badge badge--error">ICD-10 ${window.Utils.escapeHTML(classification.icd10Code || '--')}</span>
              <span class="badge badge--cached">ICD-11 ${window.Utils.escapeHTML(classification.icd11Code || '--')}</span>
            </div>
            <div class="classification-breadcrumb" aria-label="Ontology breadcrumb">
              ${breadcrumbs.map((crumb) => `<span class="chip">${window.Utils.escapeHTML(crumb)}</span>`).join('<span class="chip-sep">-></span>')}
              <span class="chip">${window.Utils.escapeHTML(classification.icd10Code || '--')}</span>
            </div>
            <div class="classification-aliases">
              <p class="classification-mini-title">Common names and aliases</p>
              <div class="classification-cloud">${aliasTags || '<span class="chip">No aliases</span>'}</div>
            </div>
          </section>
          <section class="classification-related">
            <p class="classification-mini-title">Related codes</p>
            <div class="epi-table-wrap">
              <table class="epi-table">
                <thead>
                  <tr><th>Code</th><th>Description</th></tr>
                </thead>
                <tbody>${relatedRows}</tbody>
              </table>
            </div>
          </section>
        </div>
      </article>
    `;
  }

  function renderPartial(partials, payload) {
    const rows = partials
      .slice(0, 10)
      .map((item) => `
        <tr>
          <td>${window.Utils.escapeHTML(item.name || '--')}</td>
          <td><span class="badge badge--cached">${window.Utils.escapeHTML(item.icd10 || '--')}</span></td>
          <td><span class="badge badge--source">${window.Utils.escapeHTML(item.icd11 || '--')}</span></td>
          <td>${window.Utils.escapeHTML(item.category || '--')}</td>
        </tr>
      `)
      .join('');

    return `
      <article class="card">
        <div class="card__header">
          <h2>ICD Classification Browser</h2>
          <span class="badge badge--source">ICD Mapping (Static)</span>
        </div>
        <div class="card__body">
          <p class="classification-desc">No exact ICD match for <strong>${window.Utils.escapeHTML(payload && payload.query ? payload.query.disease : 'this query')}</strong>. Showing closest suggestions.</p>
          <div class="epi-table-wrap">
            <table class="epi-table">
              <thead>
                <tr><th>Disease</th><th>ICD-10</th><th>ICD-11</th><th>Category</th></tr>
              </thead>
              <tbody>${rows || '<tr><td colspan="4">No partial matches.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </article>
    `;
  }

  function renderPayload(payload) {
    if (!root) return;

    const data = payload && payload.results ? payload.results.classification : null;
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      root.innerHTML = '';
      return;
    }

    if (data.exactMatch && data.classification) {
      root.innerHTML = renderExact(data.classification, payload);
      return;
    }

    root.innerHTML = renderPartial(Array.isArray(data.partialMatches) ? data.partialMatches : [], payload);
  }

  function init() {
    if (!root) return;

    window.addEventListener('search:start', () => {
      root.innerHTML = '';
    });

    window.addEventListener('search:complete', (event) => {
      const payload = event && event.detail ? event.detail.data : null;
      renderPayload(payload);
    });
  }

  window.ClassificationModule = {
    init,
  };
})();
