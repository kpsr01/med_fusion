(function () {
  'use strict';

  const root = document.getElementById('countryCompare');

  const COLUMNS = [
    { key: 'country', label: 'Country' },
    { key: 'cases', label: 'Cases' },
    { key: 'deaths', label: 'Deaths' },
    { key: 'recovered', label: 'Recovered' },
    { key: 'active', label: 'Active' },
    { key: 'casesPerOneMillion', label: 'Cases/1M' },
    { key: 'deathsPerOneMillion', label: 'Deaths/1M' },
  ];

  let allRows = [];
  let queryRegion = '';
  let sortBy = 'cases';
  let sortDir = 'desc';
  let showAll = false;

  function numberValue(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeCountryRecords(diseaseSh, region) {
    const rows = [];
    queryRegion = String(region || '').trim().toLowerCase();

    if (diseaseSh && diseaseSh.country && !diseaseSh.country.error) {
      const item = diseaseSh.country;
      rows.push({
        country: item.country || region || 'Queried region',
        cases: numberValue(item.cases),
        deaths: numberValue(item.deaths),
        recovered: numberValue(item.recovered),
        active: numberValue(item.active),
        casesPerOneMillion: numberValue(item.casesPerOneMillion),
        deathsPerOneMillion: numberValue(item.deathsPerOneMillion),
        isQueried: true,
      });
    }

    if (diseaseSh && Array.isArray(diseaseSh.countries)) {
      for (const item of diseaseSh.countries) {
        if (!item) continue;
        rows.push({
          country: item.country || 'Unknown',
          cases: numberValue(item.cases),
          deaths: numberValue(item.deaths),
          recovered: numberValue(item.recovered),
          active: numberValue(item.active),
          casesPerOneMillion: numberValue(item.casesPerOneMillion),
          deathsPerOneMillion: numberValue(item.deathsPerOneMillion),
          isQueried: queryRegion && String(item.country || '').toLowerCase() === queryRegion,
        });
      }
    }

    const seen = new Set();
    return rows.filter((row) => {
      const key = String(row.country || '').toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function compareRows(a, b) {
    const key = sortBy;
    if (key === 'country') {
      const av = String(a.country || '').toLowerCase();
      const bv = String(b.country || '').toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    }

    const av = numberValue(a[key]);
    const bv = numberValue(b[key]);
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  }

  function arrowFor(columnKey) {
    if (sortBy !== columnKey) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  function renderTable() {
    if (!root) return;
    if (!allRows.length) {
      root.innerHTML = '';
      return;
    }

    const sorted = allRows.slice().sort(compareRows);
    const rows = showAll ? sorted : sorted.slice(0, 10);

    const head = COLUMNS.map(
      (column) => `<th><button type="button" class="compare-sort" data-key="${column.key}">${column.label}${arrowFor(column.key)}</button></th>`
    ).join('');

    const body = rows
      .map((row) => {
        const highlightClass = row.isQueried ? ' compare-row--queried' : '';
        return `
          <tr class="compare-row${highlightClass}">
            <td>${window.Utils.escapeHTML(row.country)}</td>
            <td>${window.Utils.formatNumber(row.cases)}</td>
            <td>${window.Utils.formatNumber(row.deaths)}</td>
            <td>${window.Utils.formatNumber(row.recovered)}</td>
            <td>${window.Utils.formatNumber(row.active)}</td>
            <td>${window.Utils.formatNumber(row.casesPerOneMillion)}</td>
            <td>${window.Utils.formatNumber(row.deathsPerOneMillion)}</td>
          </tr>
        `;
      })
      .join('');

    root.innerHTML = `
      <article class="card compare-card">
        <div class="card__header">
          <h2>Country Comparison</h2>
          <span class="badge badge--source">via Disease.sh</span>
        </div>
        <div class="card__body compare-card__body">
          <div class="compare-table-wrap">
            <table class="compare-table">
              <thead><tr>${head}</tr></thead>
              <tbody>${body}</tbody>
            </table>
          </div>
        </div>
        <div class="card__footer">
          <span>Showing ${rows.length} of ${allRows.length} records</span>
          <button type="button" class="compare-toggle" id="compareShowAll">${showAll ? 'Show Top 10' : 'Show All'}</button>
        </div>
      </article>
    `;
  }

  function onClick(event) {
    const sortButton = event.target.closest('.compare-sort');
    if (sortButton) {
      const key = sortButton.getAttribute('data-key');
      if (!key) return;
      if (sortBy === key) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortBy = key;
        sortDir = key === 'country' ? 'asc' : 'desc';
      }
      renderTable();
      return;
    }

    const toggle = event.target.closest('#compareShowAll');
    if (toggle) {
      showAll = !showAll;
      renderTable();
    }
  }

  function clear() {
    allRows = [];
    showAll = false;
    sortBy = 'cases';
    sortDir = 'desc';
    if (root) root.innerHTML = '';
  }

  function handleSearchComplete(detail) {
    const payload = detail && detail.data;
    const query = payload && payload.query ? payload.query : {};
    const epi = payload && payload.results ? payload.results.epidemiological : null;
    const diseaseSh = epi && epi['Disease.sh'];

    allRows = normalizeCountryRecords(diseaseSh, query.region);
    showAll = false;
    sortBy = 'cases';
    sortDir = 'desc';
    renderTable();
  }

  function init() {
    if (!root) return;
    root.addEventListener('click', onClick);
    window.addEventListener('search:start', clear);
    window.addEventListener('search:complete', (event) => handleSearchComplete(event.detail));
  }

  window.CountryCompareModule = {
    init,
  };
})();
