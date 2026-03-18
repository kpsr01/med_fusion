(function () {
  'use strict';

  function formatNumber(n) {
    if (n === null || n === undefined || n === '') return '--';
    const value = Number(n);
    return Number.isFinite(value) ? value.toLocaleString() : '--';
  }

  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function timeAgo(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(date.getTime())) return '--';

    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 5) return 'just now';

    const units = [
      { label: 'year', secs: 31536000 },
      { label: 'month', secs: 2592000 },
      { label: 'week', secs: 604800 },
      { label: 'day', secs: 86400 },
      { label: 'hour', secs: 3600 },
      { label: 'minute', secs: 60 },
      { label: 'second', secs: 1 },
    ];

    for (const unit of units) {
      const value = Math.floor(seconds / unit.secs);
      if (value >= 1) {
        return value === 1 ? `1 ${unit.label} ago` : `${value} ${unit.label}s ago`;
      }
    }

    return 'just now';
  }

  function debounce(fn, ms) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function showSection(idOrEl) {
    const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (el) el.hidden = false;
    return el;
  }

  function hideSection(idOrEl) {
    const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (el) el.hidden = true;
    return el;
  }

  function createEl(tag, className, innerHTML) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML !== undefined && innerHTML !== null) el.innerHTML = innerHTML;
    return el;
  }

  async function fetchJSON(url, options) {
    const response = await fetch(url, options);
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const message = (body && (body.message || body.error)) || `Request failed (${response.status})`;
      const err = new Error(message);
      err.status = response.status;
      err.body = body;
      throw err;
    }

    return body;
  }

  const SOURCE_COLORS = {
    'Disease.sh': '#4ecdc4',
    'WHO GHO': '#ffd166',
    'CDC Open Data': '#4f8cff',
    'CDC FluView': '#6aa0ff',
    HealthMap: '#ff6b6b',
    'ProMED Mail': '#f08a5d',
    'IHME GHDx': '#7e5bef',
    ECDC: '#42b883',
    UKHSA: '#00a8e8',
    'Open Targets': '#ef476f',
    PubChem: '#06d6a0',
    'ICD Mapping': '#b8b8ff',
  };

  const SOURCE_ICONS = {
    'Disease.sh': 'activity',
    'WHO GHO': 'globe',
    'CDC Open Data': 'database',
    'CDC FluView': 'thermometer',
    HealthMap: 'map-pin',
    'ProMED Mail': 'newspaper',
    'IHME GHDx': 'bar-chart-3',
    ECDC: 'shield-check',
    UKHSA: 'building-2',
    'Open Targets': 'dna',
    PubChem: 'flask-conical',
    'ICD Mapping': 'book-open-check',
  };

  window.Utils = {
    formatNumber,
    escapeHTML,
    timeAgo,
    debounce,
    showSection,
    hideSection,
    createEl,
    fetchJSON,
    SOURCE_COLORS,
    SOURCE_ICONS,
  };
})();
