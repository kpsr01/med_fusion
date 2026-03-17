/**
 * CDC FluView Connector
 * Scrapes/fetches CDC influenza surveillance data.
 * Uses CDC FluView API and CSV data endpoints.
 * Auth: None required
 */

const axios = require('axios');
const cheerio = require('cheerio');

/**
 * CDC FluView API endpoints for ILINet and clinical lab data.
 */
const FLUVIEW_API_BASE = 'https://gis.cdc.gov/grasp/flu2/PostPhase02DataDownload';
const FLUVIEW_SUMMARY_URL = 'https://www.cdc.gov/flu/weekly/index.htm';

/**
 * Flu-related disease aliases.
 */
const FLU_ALIASES = ['flu', 'influenza', 'influenza a', 'influenza b', 'h1n1', 'h3n2', 'seasonal flu'];

/**
 * Fetch influenza surveillance data from CDC FluView.
 * @param {Object} params
 * @param {string} params.disease - Disease name
 * @param {string} [params.region] - Region (FluView is US-focused)
 * @returns {Promise<Object>} { source, data, timestamp, status }
 */
async function fetchData({ disease, region }) {
  const diseaseLower = (disease || '').toLowerCase();

  // Only respond to flu-related queries
  if (!FLU_ALIASES.includes(diseaseLower)) {
    return {
      source: 'CDC FluView',
      data: null,
      timestamp: new Date().toISOString(),
      status: 'skipped',
      message: 'CDC FluView only provides influenza surveillance data',
    };
  }

  const results = {};

  // Strategy 1: Try to scrape the CDC Flu Weekly summary page
  try {
    const response = await axios.get(FLUVIEW_SUMMARY_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DiseaseTracker/1.0)',
      },
    });
    const $ = cheerio.load(response.data);

    // Extract key surveillance summary info
    const summaryText = [];
    $('div.card-body p, div.syndicate p, .content p').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 20 && text.length < 500) {
        summaryText.push(text);
      }
    });

    results.weeklySummary = {
      url: FLUVIEW_SUMMARY_URL,
      excerpts: summaryText.slice(0, 5),
    };
  } catch (err) {
    results.weeklySummary = { error: err.message };
  }

  // Strategy 2: Try FluView Interactive data API
  try {
    const currentYear = new Date().getFullYear();
    const apiUrl = `https://gis.cdc.gov/grasp/flu2/GetPhase02InitApp?appVersion=Public`;

    const initResponse = await axios.get(apiUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DiseaseTracker/1.0)',
      },
    });

    if (initResponse.data) {
      results.fluViewInteractive = {
        available: true,
        currentSeason: `${currentYear - 1}-${currentYear}`,
        dataSource: 'CDC FluView Interactive',
        note: 'ILINet and clinical laboratory data available',
      };
    }
  } catch (err) {
    results.fluViewInteractive = {
      available: false,
      error: err.message,
    };
  }

  // Strategy 3: Fetch WHO/NREVSS clinical lab data overview
  try {
    const clinLabUrl = 'https://www.cdc.gov/flu/weekly/weeklyarchives2024-2025/data/whoAllregt_cl.html';
    const response = await axios.get(clinLabUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DiseaseTracker/1.0)',
      },
    });
    const $ = cheerio.load(response.data);

    // Try to extract table data
    const tableData = [];
    $('table tr').each((i, row) => {
      const cells = [];
      $(row).find('td, th').each((j, cell) => {
        cells.push($(cell).text().trim());
      });
      if (cells.length > 0) {
        tableData.push(cells);
      }
    });

    if (tableData.length > 0) {
      results.clinicalLabData = {
        headers: tableData[0],
        recentWeeks: tableData.slice(1, 6),
      };
    }
  } catch (err) {
    results.clinicalLabData = { error: err.message };
  }

  return {
    source: 'CDC FluView',
    data: {
      disease: 'influenza',
      region: region || 'US',
      note: 'CDC FluView data is US-focused. Surveillance includes ILINet, clinical labs, and mortality data.',
      ...results,
    },
    timestamp: new Date().toISOString(),
    status: 'ok',
  };
}

module.exports = { fetchData };
