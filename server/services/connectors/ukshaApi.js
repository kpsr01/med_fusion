/**
 * UKHSA (UK Health Security Agency) Connector
 * REST API — UK health statistics for COVID, influenza, respiratory diseases.
 * Base URL: https://api.ukhsa-dashboard.data.gov.uk/
 * Auth: None required
 */

const axios = require('axios');

const BASE_URL = 'https://api.ukhsa-dashboard.data.gov.uk';

/**
 * UKHSA theme/topic mapping for diseases.
 */
const DISEASE_TOPICS = {
  covid: {
    theme: 'infectious_disease',
    sub_theme: 'respiratory',
    topic: 'COVID-19',
    metrics: [
      'COVID-19_cases_casesByDay',
      'COVID-19_deaths_ONSByDay',
      'COVID-19_healthcare_admissionByDay',
      'COVID-19_vaccinations_autumn22_uptakeByDay',
    ],
  },
  influenza: {
    theme: 'infectious_disease',
    sub_theme: 'respiratory',
    topic: 'Influenza',
    metrics: [
      'influenza_healthcare_ICUHDUadmissionRateByWeek',
      'influenza_testing_positivityByWeek',
    ],
  },
  rsv: {
    theme: 'infectious_disease',
    sub_theme: 'respiratory',
    topic: 'RSV',
    metrics: [
      'RSV_healthcare_admissionRateByWeek',
    ],
  },
};

/**
 * Disease alias mapping for UKHSA.
 */
const DISEASE_ALIASES = {
  'covid-19': 'covid',
  covid19: 'covid',
  coronavirus: 'covid',
  'sars-cov-2': 'covid',
  flu: 'influenza',
  'respiratory syncytial virus': 'rsv',
};

/**
 * Fetch health data from UKHSA Dashboard API.
 * @param {Object} params
 * @param {string} params.disease - Disease name
 * @param {string} [params.region] - Region (UKHSA is UK-focused)
 * @returns {Promise<Object>} { source, data, timestamp, status }
 */
async function fetchData({ disease, region }) {
  const diseaseLower = (disease || '').toLowerCase();
  const regionLower = (region || '').toLowerCase();
  const canonicalDisease = DISEASE_ALIASES[diseaseLower] || diseaseLower;

  // UKHSA is UK-specific
  const ukAliases = ['uk', 'united kingdom', 'england', 'gbr', 'gb', 'global', ''];
  const isRelevantRegion = !regionLower || ukAliases.includes(regionLower);

  const topicConfig = DISEASE_TOPICS[canonicalDisease];
  if (!topicConfig) {
    return {
      source: 'UKHSA',
      data: null,
      timestamp: new Date().toISOString(),
      status: 'skipped',
      message: `No UKHSA data mapping for disease: ${disease}. Available: COVID-19, Influenza, RSV.`,
    };
  }

  const results = {};

  // Query UKHSA themes endpoint
  try {
    const themesUrl = `${BASE_URL}/themes/${topicConfig.theme}/sub_themes/${topicConfig.sub_theme}/topics/${topicConfig.topic}`;
    const response = await axios.get(themesUrl, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      },
    });

    results.topicInfo = response.data;
  } catch (err) {
    results.topicInfo = { error: err.message };
  }

  // Fetch metric-specific data
  for (const metric of topicConfig.metrics) {
    try {
      const metricUrl = `${BASE_URL}/themes/${topicConfig.theme}/sub_themes/${topicConfig.sub_theme}/topics/${topicConfig.topic}/geography_types/Nation/geographies/England/metrics/${metric}`;
      const response = await axios.get(metricUrl, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
        },
        params: {
          page_size: 30,
          format: 'json',
        },
      });

      const records = response.data.results || response.data || [];
      results[metric] = {
        metricName: metric,
        recordCount: Array.isArray(records) ? records.length : 0,
        records: Array.isArray(records) ? records.slice(0, 15) : records,
      };
    } catch (err) {
      results[metric] = {
        metricName: metric,
        error: err.message,
      };
    }
  }

  return {
    source: 'UKHSA',
    data: {
      disease: canonicalDisease,
      region: isRelevantRegion ? 'United Kingdom' : region,
      note: 'UK Health Security Agency dashboard data. Covers COVID-19, influenza, and RSV surveillance for England.',
      metrics: results,
    },
    timestamp: new Date().toISOString(),
    status: 'ok',
  };
}

module.exports = { fetchData };
