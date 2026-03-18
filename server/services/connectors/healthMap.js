/**
 * HealthMap Connector
 * Web scraping — outbreak alerts from healthmap.org.
 * No public API available — uses cheerio to parse alert listings.
 * Auth: None required
 * Note: Scraping may be unreliable; designed to fail gracefully.
 */

const axios = require('axios');
const cheerio = require('cheerio');

const HEALTHMAP_URL = 'https://www.healthmap.org/en/';
const HEALTHMAP_ALERTS_URL = 'https://www.healthmap.org/getAlerts.php';

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseMarkerHtml(placeName, html, defaultUrl) {
  const $ = cheerio.load(`<div>${html || ''}</div>`);
  const rows = [];

  $('a.fbox').each((_, element) => {
    const anchor = $(element);
    const parent = anchor.closest('.at');
    const title = cleanText(anchor.text());
    const href = cleanText(anchor.attr('href'));
    const date = cleanText(parent.find('.d').first().text()).replace(/-\s*$/, '').trim();

    if (!title) return;

    rows.push({
      title,
      location: cleanText(placeName),
      date,
      summary: null,
      link: href && href.startsWith('http') ? href : (defaultUrl || null),
    });
  });

  return rows;
}

function uniqueAlerts(alerts) {
  const seen = new Set();
  const rows = [];

  for (const alert of alerts) {
    const key = `${cleanText(alert.title).toLowerCase()}|${cleanText(alert.location).toLowerCase()}|${cleanText(alert.date).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(alert);
  }

  return rows;
}

/**
 * Fetch outbreak alert data by scraping HealthMap.
 * @param {Object} params
 * @param {string} params.disease - Disease name to search for
 * @param {string} [params.region] - Region to filter by
 * @returns {Promise<Object>} { source, data, timestamp, status }
 */
async function fetchData({ disease, region, diseaseAliases }) {
  const diseaseLower = (disease || '').toLowerCase();
  const regionLower = (region || '').toLowerCase();
  const aliases = Array.isArray(diseaseAliases)
    ? diseaseAliases.map((name) => String(name || '').toLowerCase()).filter(Boolean)
    : [];
  const diseaseTerms = Array.from(new Set([diseaseLower, ...aliases].filter(Boolean)));

  try {
    // HealthMap uses a JSON endpoint behind the map UI.
    let alerts = [];

    try {
      const response = await axios.get(HEALTHMAP_ALERTS_URL, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DiseaseTracker/1.0)',
          'Accept': 'application/json',
        },
        params: {
          disease: disease,
          region: region || '',
        },
      });

      const payload = response.data;
      const markers = payload && Array.isArray(payload.markers) ? payload.markers : [];

      if (markers.length) {
        const parsed = [];
        for (const marker of markers) {
          const placeName = cleanText(marker && marker.place_name);
          const markerRows = parseMarkerHtml(placeName, marker && marker.html, HEALTHMAP_URL);

          if (markerRows.length) {
            parsed.push(...markerRows);
            continue;
          }

          const label = cleanText(marker && marker.label).replace(/^,\s*/, '');
          if (placeName || label) {
            parsed.push({
              title: label || `Outbreak signal: ${placeName || 'unknown location'}`,
              location: placeName || null,
              date: null,
              summary: null,
              link: HEALTHMAP_URL,
            });
          }
        }

        alerts = uniqueAlerts(parsed);
      }
    } catch (apiErr) {
      // API not available, fall back to scraping the main page
    }

    // Fallback: Scrape the main HealthMap page for visible alerts
    if (alerts.length === 0) {
      const response = await axios.get(HEALTHMAP_URL, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
      });

      const $ = cheerio.load(response.data);

      // Parse alert listings from the page
      $('div.alert, div.alertItem, li.alert-item, .event-item, .marker-popup').each((i, el) => {
        const title = $(el).find('.title, .alert-title, h3, h4, a').first().text().trim();
        const location = $(el).find('.location, .alert-location, .place').first().text().trim();
        const date = $(el).find('.date, .alert-date, .time').first().text().trim();
        const summary = $(el).find('.summary, .description, p').first().text().trim();
        const link = $(el).find('a').first().attr('href');

        if (title) {
          alerts.push({ title, location, date, summary, link });
        }
      });

    }

    // Filter alerts by disease and region keywords
    const filteredByDiseaseAndRegion = alerts.filter((alert) => {
      const text = `${alert.title || ''} ${alert.summary || ''} ${alert.location || ''}`.toLowerCase();
      const diseaseMatch =
        diseaseTerms.length === 0
          ? true
          : diseaseTerms.some((term) => term && text.includes(term));
      const regionMatch = !regionLower || regionLower === 'global' || text.includes(regionLower);
      return diseaseMatch && regionMatch;
    });

    // If strict disease filtering misses (common with abbreviated headlines),
    // retain region-filtered rows from the disease-specific API response.
    const regionFiltered = alerts.filter((alert) => {
      const text = `${alert.title || ''} ${alert.summary || ''} ${alert.location || ''}`.toLowerCase();
      return !regionLower || regionLower === 'global' || text.includes(regionLower);
    });

    const finalAlerts = filteredByDiseaseAndRegion.length
      ? filteredByDiseaseAndRegion
      : regionFiltered;

    return {
      source: 'HealthMap',
      data: {
        disease: diseaseLower,
        region: region || 'global',
        alertCount: finalAlerts.length,
        alerts: finalAlerts.slice(0, 25),
        note: 'HealthMap data obtained via web scraping. Results may be incomplete.',
      },
      timestamp: new Date().toISOString(),
      status: 'ok',
    };
  } catch (err) {
    return {
      source: 'HealthMap',
      data: null,
      timestamp: new Date().toISOString(),
      status: 'error',
      error: `HealthMap scraping failed: ${err.message}`,
      message: 'HealthMap has no public API. Scraping may be blocked or the site structure may have changed.',
    };
  }
}

module.exports = { fetchData };
