(function () {
  'use strict';

  let latestPayload = null;

  const COUNTRY_CENTROIDS = {
    india: [20.5937, 78.9629],
    'united states': [39.8283, -98.5795],
    usa: [39.8283, -98.5795],
    brazil: [-14.235, -51.9253],
    china: [35.8617, 104.1954],
    africa: [1.65, 17.5],
    europe: [54.526, 15.2551],
    global: [20, 8],
  };

  function getState() {
    return window.__cbMap && window.__cbMap.map ? window.__cbMap : null;
  }

  function extractAlerts(payload) {
    if (!payload || !payload.results || !Array.isArray(payload.results.outbreakAlerts)) return [];
    return payload.results.outbreakAlerts;
  }

  function classifySeverity(alert) {
    const text = `${alert && alert.title ? alert.title : ''} ${alert && alert.summary ? alert.summary : ''}`.toLowerCase();
    if (text.includes('death') || text.includes('fatal') || text.includes('critical') || text.includes('outbreak')) return 'high';
    if (text.includes('cluster') || text.includes('spike') || text.includes('concern')) return 'medium';
    return 'low';
  }

  function parseCoordinates(alert) {
    const latKeys = ['lat', 'latitude', 'y'];
    const lngKeys = ['lon', 'lng', 'longitude', 'x'];

    for (const latKey of latKeys) {
      for (const lngKey of lngKeys) {
        const lat = Number(alert && alert[latKey]);
        const lng = Number(alert && alert[lngKey]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return [lat, lng];
        }
      }
    }

    const location = String(alert && (alert.location || alert.region || alert.country) ? (alert.location || alert.region || alert.country) : '').toLowerCase();
    if (!location) return null;

    for (const key of Object.keys(COUNTRY_CENTROIDS)) {
      if (location.includes(key)) return COUNTRY_CENTROIDS[key];
    }

    return null;
  }

  function markerClass(severity, source) {
    const sourceKey = source && source.toLowerCase().includes('promed') ? 'promed' : 'healthmap';
    return `map-alert map-alert--${severity} map-alert--${sourceKey}`;
  }

  function clearLayer() {
    const state = getState();
    if (!state || !state.map) return;

    if (state.alertLayer) {
      state.map.removeLayer(state.alertLayer);
      state.alertLayer = null;
    }
  }

  function render() {
    const state = getState();
    if (!state || !state.map || !window.L || !latestPayload) return;

    clearLayer();

    const alerts = extractAlerts(latestPayload)
      .map((alert) => ({ alert, point: parseCoordinates(alert), severity: classifySeverity(alert) }))
      .filter((item) => Array.isArray(item.point));

    if (!alerts.length) return;

    const cluster = window.L.markerClusterGroup({
      pane: 'alertsPane',
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 45,
    });

    alerts.forEach((item) => {
      const source = item.alert && item.alert.source ? item.alert.source : 'Unknown';
      const dot = `<span class="${markerClass(item.severity, source)}"></span>`;
      const icon = window.L.divIcon({
        className: 'map-alert-wrap',
        html: dot,
        iconSize: [16, 16],
      });

      const marker = window.L.marker(item.point, { icon });
      const title = item.alert && item.alert.title ? item.alert.title : 'Untitled alert';
      const href = item.alert && (item.alert.link || item.alert.url) ? (item.alert.link || item.alert.url) : null;
      const date = item.alert && item.alert.date ? item.alert.date : '--';
      const location = item.alert && (item.alert.location || item.alert.region || item.alert.country) ? (item.alert.location || item.alert.region || item.alert.country) : 'Unknown location';

      marker.bindPopup(`
        <article class="map-alert-popup">
          <p class="map-alert-popup__source">${window.Utils.escapeHTML(source)} · ${window.Utils.escapeHTML(item.severity)} severity</p>
          <h3 class="map-alert-popup__title">${href ? `<a href="${window.Utils.escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${window.Utils.escapeHTML(title)}</a>` : window.Utils.escapeHTML(title)}</h3>
          <p class="map-alert-popup__meta">${window.Utils.escapeHTML(location)} · ${window.Utils.escapeHTML(date)}</p>
        </article>
      `);

      cluster.addLayer(marker);
    });

    state.alertLayer = cluster;
    state.map.addLayer(cluster);
  }

  function init() {
    window.addEventListener('map:ready', () => {
      if (latestPayload) render();
    });

    window.addEventListener('search:start', () => {
      latestPayload = null;
      clearLayer();
    });

    window.addEventListener('search:complete', (event) => {
      latestPayload = event && event.detail ? event.detail.data : null;
      render();
    });
  }

  window.MapAlertsModule = {
    init,
  };
})();
