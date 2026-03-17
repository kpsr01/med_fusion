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

/**
 * Fetch outbreak alert data by scraping HealthMap.
 * @param {Object} params
 * @param {string} params.disease - Disease name to search for
 * @param {string} [params.region] - Region to filter by
 * @returns {Promise<Object>} { source, data, timestamp, status }
 */
async function fetchData({ disease, region }) {
  const diseaseLower = (disease || '').toLowerCase();
  const regionLower = (region || '').toLowerCase();

  try {
    // HealthMap uses a JSON API behind the scenes for alert data
    // Try the alerts API endpoint first
    const alertsUrl = `https://www.healthmap.org/getAlerts.php`;
    let alerts = [];

    try {
      const response = await axios.get(alertsUrl, {
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

      if (Array.isArray(response.data)) {
        alerts = response.data;
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

      // Filter alerts by disease and region keywords
      alerts = alerts.filter((alert) => {
        const text = `${alert.title} ${alert.summary} ${alert.location}`.toLowerCase();
        const diseaseMatch = text.includes(diseaseLower);
        const regionMatch = !regionLower || regionLower === 'global' || text.includes(regionLower);
        return diseaseMatch && regionMatch;
      });
    }

    return {
      source: 'HealthMap',
      data: {
        disease: diseaseLower,
        region: region || 'global',
        alertCount: alerts.length,
        alerts: alerts.slice(0, 20), // Limit to 20 most relevant
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
