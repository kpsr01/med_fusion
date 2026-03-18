(function () {
  'use strict';

  const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

  const ISO_FIXUPS = {
    USA: 'USA',
    GBR: 'GBR',
    RUS: 'RUS',
    KOR: 'KOR',
    PRK: 'PRK',
    IRN: 'IRN',
    LAO: 'LAO',
    BOL: 'BOL',
    VEN: 'VEN',
    COD: 'COD',
    COG: 'COG',
    SYR: 'SYR',
    TZA: 'TZA',
    CIV: 'CIV',
    VNM: 'VNM',
  };

  let geoJsonData = null;
  let latestPayload = null;
  let legendControl = null;
  let focusControl = null;
  let maxValue = 0;

  function getMapState() {
    return window.__cbMap && window.__cbMap.map ? window.__cbMap : null;
  }

  function toIso3(record) {
    if (!record) return null;
    const raw = String(record.countryInfo && record.countryInfo.iso3 ? record.countryInfo.iso3 : '').toUpperCase();
    if (!raw) return null;
    return ISO_FIXUPS[raw] || raw;
  }

  function metricFromRecord(record, metric) {
    const value = Number(record && record[metric]);
    return Number.isFinite(value) ? value : null;
  }

  function metricLabel(metric) {
    return metric === 'deathsPerOneMillion' ? 'Deaths / 1M' : 'Cases / 1M';
  }

  function buildMetricIndex(payload) {
    const map = new Map();
    if (!payload || !payload.results || !payload.results.epidemiological) return map;

    const diseaseSh = payload.results.epidemiological['Disease.sh'];
    const countries = diseaseSh && Array.isArray(diseaseSh.countries) ? diseaseSh.countries : [];

    for (const country of countries) {
      const iso = toIso3(country);
      if (!iso) continue;
      map.set(iso, country);
    }

    return map;
  }

  function getColor(value) {
    if (!Number.isFinite(value) || value <= 0 || maxValue <= 0) return 'rgba(57, 78, 108, 0.45)';
    const ratio = Math.min(1, value / maxValue);
    if (ratio > 0.85) return '#ff5f6d';
    if (ratio > 0.65) return '#ff8466';
    if (ratio > 0.45) return '#ffb868';
    if (ratio > 0.25) return '#70d89f';
    return '#57b4f9';
  }

  function featureIso3(feature) {
    const properties = feature && feature.properties ? feature.properties : {};
    return String(
      properties['ISO3166-1-Alpha-3'] ||
      properties.ISO_A3 ||
      properties.ISO3 ||
      properties.ADM0_A3 ||
      ''
    ).toUpperCase();
  }

  function featureName(feature) {
    const properties = feature && feature.properties ? feature.properties : {};
    return properties.name || properties.ADMIN || properties.NAME || properties.SOVEREIGNT || 'Unknown country';
  }

  function clearLayer() {
    const state = getMapState();
    if (!state || !state.map) return;
    if (state.choroplethLayer) {
      state.map.removeLayer(state.choroplethLayer);
      state.choroplethLayer = null;
    }
    if (legendControl) {
      state.map.removeControl(legendControl);
      legendControl = null;
    }
    if (focusControl) {
      state.map.removeControl(focusControl);
      focusControl = null;
    }
  }

  function publishSelection(country, iso3) {
    const state = getMapState();
    if (!state) return;
    state.selectedCountry = country;
    state.selectedIso3 = iso3;
    window.dispatchEvent(new CustomEvent('geo:country-selected', { detail: { country, iso3 } }));
  }

  function addLegend(metric) {
    const state = getMapState();
    if (!state || !state.map || !window.L) return;

    legendControl = window.L.control({ position: 'bottomright' });
    legendControl.onAdd = function onAdd() {
      const div = window.L.DomUtil.create('div', 'map-legend');
      const label = metric === 'deathsPerOneMillion' ? 'Deaths / 1M' : 'Cases / 1M';
      const steps = [0, 0.25, 0.45, 0.65, 0.85].map((p) => Math.round(maxValue * p));
      div.innerHTML = `
        <p class="map-legend__title">${window.Utils.escapeHTML(label)}</p>
        <div class="map-legend__row"><span style="background:${getColor(steps[0])}"></span>Low</div>
        <div class="map-legend__row"><span style="background:${getColor(steps[2])}"></span>Medium</div>
        <div class="map-legend__row"><span style="background:${getColor(steps[4])}"></span>High</div>
      `;
      return div;
    };
    legendControl.addTo(state.map);
  }

  function setFocusInfo(countryName, metric, value) {
    const node = focusControl && typeof focusControl.getContainer === 'function'
      ? focusControl.getContainer()
      : null;
    if (!node) return;

    if (!countryName) {
      node.innerHTML = '<p class="map-hover__title">Selected country</p><p class="map-hover__meta">Click a country to pin details</p>';
      return;
    }

    node.innerHTML = `
      <p class="map-hover__title">${window.Utils.escapeHTML(countryName)}</p>
      <p class="map-hover__meta">${window.Utils.escapeHTML(metricLabel(metric))}: ${window.Utils.escapeHTML(window.Utils.formatNumber(value))}</p>
      <p class="map-hover__meta">via Disease.sh</p>
    `;
  }

  function addFocusControl(metric, metricIndex) {
    const state = getMapState();
    if (!state || !state.map || !window.L) return;

    focusControl = window.L.control({ position: 'topright' });
    focusControl.onAdd = function onAdd() {
      const div = window.L.DomUtil.create('div', 'map-hover map-hover--selected');
      return div;
    };
    focusControl.addTo(state.map);

    if (state.selectedIso3) {
      const selectedData = metricIndex.get(state.selectedIso3);
      setFocusInfo(state.selectedCountry || 'Selected country', metric, metricFromRecord(selectedData, metric));
      return;
    }

    setFocusInfo(null, metric, null);
  }

  async function loadGeoJson() {
    if (geoJsonData) return geoJsonData;
    geoJsonData = await window.Utils.fetchJSON(GEOJSON_URL);
    return geoJsonData;
  }

  async function render() {
    const state = getMapState();
    if (!state || !state.map || !window.L || !latestPayload) return;

    const metric = state.metric || 'casesPerOneMillion';
    const metricIndex = buildMetricIndex(latestPayload);
    const selectedStyle = {
      weight: 2.1,
      color: '#ffe6a6',
    };
    let selectedLayer = null;
    const values = Array.from(metricIndex.values())
      .map((record) => metricFromRecord(record, metric))
      .filter((n) => Number.isFinite(n));

    if (values.length === 0) {
      clearLayer();
      return;
    }

    maxValue = Math.max(...values, 1);
    const geo = await loadGeoJson();

    clearLayer();
    addFocusControl(metric, metricIndex);

    state.choroplethLayer = window.L.geoJSON(geo, {
      pane: 'choroplethPane',
      style(feature) {
        const iso = featureIso3(feature);
        const data = metricIndex.get(iso);
        const value = metricFromRecord(data, metric);
        return {
          weight: 0.8,
          opacity: 1,
          color: 'rgba(180, 210, 248, 0.35)',
          fillOpacity: value === null ? 0.2 : 0.75,
          fillColor: getColor(value),
        };
      },
      onEachFeature(feature, layer) {
        const iso = featureIso3(feature);
        const countryName = featureName(feature);
        const data = metricIndex.get(iso);
        const value = metricFromRecord(data, metric);

        layer.bindTooltip(`
          <div class="map-tooltip">
            <p class="map-tooltip__country">${window.Utils.escapeHTML(countryName)}</p>
            <p>${window.Utils.escapeHTML(metricLabel(metric))}: <strong>${window.Utils.escapeHTML(window.Utils.formatNumber(value))}</strong></p>
            <p>Source: Disease.sh</p>
          </div>
        `, {
          className: 'map-tooltip-shell',
          direction: 'top',
          sticky: true,
          offset: [0, -8],
        });

        layer.on('mouseover', function onOver() {
          this.setStyle(selectedLayer === this ? selectedStyle : { weight: 1.5, color: '#9fd4ff' });
        });

        layer.on('mouseout', function onOut() {
          if (selectedLayer === this) {
            this.setStyle(selectedStyle);
            return;
          }
          state.choroplethLayer.resetStyle(this);
        });

        layer.on('click', () => {
          if (selectedLayer && selectedLayer !== layer && state.choroplethLayer) {
            state.choroplethLayer.resetStyle(selectedLayer);
          }
          selectedLayer = layer;
          selectedLayer.setStyle(selectedStyle);

          publishSelection(countryName, iso);
          setFocusInfo(countryName, metric, value);
          window.dispatchEvent(new CustomEvent('search:region-focus', { detail: { country: countryName, iso3: iso } }));
        });

        if (state.selectedIso3 && state.selectedIso3 === iso) {
          selectedLayer = layer;
          selectedLayer.setStyle(selectedStyle);
          setFocusInfo(countryName, metric, value);
        }
      },
    }).addTo(state.map);

    addLegend(metric);
  }

  function onSearchComplete(detail) {
    latestPayload = detail && detail.data ? detail.data : null;
    render().catch(() => {
      clearLayer();
    });
  }

  function init() {
    window.addEventListener('map:ready', () => {
      if (latestPayload) render().catch(() => {});
    });

    window.addEventListener('map:metric-change', () => {
      if (latestPayload) render().catch(() => {});
    });

    window.addEventListener('search:start', () => {
      latestPayload = null;
      const state = getMapState();
      if (state) {
        state.selectedCountry = null;
        state.selectedIso3 = null;
      }
      window.dispatchEvent(new CustomEvent('geo:country-selected', { detail: { country: null, iso3: null } }));
      clearLayer();
    });

    window.addEventListener('search:complete', (event) => onSearchComplete(event.detail));
  }

  window.MapChoroplethModule = {
    init,
  };
})();
