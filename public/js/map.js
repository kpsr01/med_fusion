(function () {
  'use strict';

  const root = document.getElementById('geoMapPanel');
  let map = null;

  function ensureShell() {
    if (!root) return null;
    if (document.getElementById('geoMapCanvas')) return document.getElementById('geoMapCanvas');

    root.innerHTML = `
      <article class="card map-card">
        <div class="card__header">
          <h2>Geographic Intelligence Map</h2>
          <span class="badge badge--source">Leaflet + Multi-source overlay</span>
        </div>
        <div class="card__body map-card__body">
          <div class="map-toolbar">
            <div class="map-toolbar__group" id="mapMetricButtons">
              <button type="button" class="chart-toggle is-active" data-map-metric="casesPerOneMillion">Cases / 1M</button>
              <button type="button" class="chart-toggle" data-map-metric="deathsPerOneMillion">Deaths / 1M</button>
            </div>
            <p class="map-toolbar__hint" id="mapSelectedCountry">Click a country to focus related insights.</p>
          </div>
          <div id="geoMapCanvas" class="map-canvas" role="img" aria-label="Global epidemiological map"></div>
        </div>
      </article>
    `;

    return document.getElementById('geoMapCanvas');
  }

  function initMap() {
    if (!root || !window.L) return;
    const canvas = ensureShell();
    if (!canvas || map) return;

    map = window.L.map(canvas, {
      worldCopyJump: true,
      minZoom: 1.8,
      zoomControl: true,
      attributionControl: true,
    }).setView([20, 8], 2);

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);

    map.createPane('choroplethPane');
    map.getPane('choroplethPane').style.zIndex = 420;

    map.createPane('alertsPane');
    map.getPane('alertsPane').style.zIndex = 610;

    window.__cbMap = {
      map,
      choroplethLayer: null,
      alertLayer: null,
      metric: 'casesPerOneMillion',
      selectedCountry: null,
      selectedIso3: null,
    };

    window.dispatchEvent(new CustomEvent('map:ready', { detail: { map } }));
  }

  function onMetricClick(event) {
    const button = event.target.closest('[data-map-metric]');
    if (!button) return;

    const metric = button.getAttribute('data-map-metric');
    if (!metric) return;

    window.__cbMap = window.__cbMap || {};
    window.__cbMap.metric = metric;

    const buttons = root.querySelectorAll('[data-map-metric]');
    buttons.forEach((el) => el.classList.toggle('is-active', el === button));

    window.dispatchEvent(new CustomEvent('map:metric-change', { detail: { metric } }));
  }

  function handleCountrySelection(detail) {
    const label = document.getElementById('mapSelectedCountry');
    if (!label) return;

    if (!detail || !detail.country) {
      label.textContent = 'Click a country to focus related insights.';
      return;
    }

    label.textContent = `Focused country: ${detail.country}`;
  }

  function init() {
    if (!root) return;

    ensureShell();

    if (!window.L) {
      root.innerHTML = '<article class="card"><div class="card__body"><p>Leaflet is unavailable. Geographic map cannot render.</p></div></article>';
      return;
    }

    initMap();
    root.addEventListener('click', onMetricClick);
    window.addEventListener('geo:country-selected', (event) => handleCountrySelection(event.detail));
    window.addEventListener('tab:changed', (event) => {
      const tabId = event && event.detail ? event.detail.tabId : null;
      if (tabId === 'epidemiological' && map) {
        window.setTimeout(() => {
          if (map) map.invalidateSize(true);
        }, 150);
      }
    });
  }

  window.MapModule = {
    init,
  };
})();
