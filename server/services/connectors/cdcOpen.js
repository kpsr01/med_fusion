/**
 * CDC Open Data Connector
 * SODA API — disease statistics from data.cdc.gov.
 * Auth: None required (app token optional for higher rate limits)
 */

const axios = require('axios');

const BASE_URL = 'https://data.cdc.gov/resource';

/**
 * Pre-mapped dataset IDs per disease category.
 * Each entry contains the SODA dataset resource ID and relevant filters.
 */
const DATASET_MAP = {
  covid: {
    datasets: [
      {
        id: '9mfq-cb36',
        label: 'COVID-19 case surveillance public use data',
        diseaseFilter: null, // entire dataset is COVID
        fields: '$select=current_status,sex,age_group,race_ethnicity_combined,hosp_yn,death_yn&$limit=100&$order=case_month DESC',
      },
    ],
  },
  nndss: {
    // NNDSS Weekly Tables — nationally notifiable diseases
    datasets: [
      {
        id: 't4hh-bij3',
        label: 'NNDSS Weekly Data',
        diseaseFilter: 'label',
        fields: '$limit=50&$order=mmwr_year DESC,mmwr_week DESC',
      },
    ],
  },
  salmonella: {
    datasets: [
      {
        id: 't4hh-bij3',
        label: 'NNDSS Weekly Data — Salmonellosis',
        diseaseFilter: 'label',
        diseaseValue: 'Salmonellosis',
        fields: '$limit=50&$order=mmwr_year DESC,mmwr_week DESC',
      },
    ],
  },
  tuberculosis: {
    datasets: [
      {
        id: 't4hh-bij3',
        label: 'NNDSS Weekly Data — Tuberculosis',
        diseaseFilter: 'label',
        diseaseValue: 'Tuberculosis',
        fields: '$limit=50&$order=mmwr_year DESC,mmwr_week DESC',
      },
    ],
  },
  hepatitis: {
    datasets: [
      {
        id: 't4hh-bij3',
        label: 'NNDSS Weekly Data — Hepatitis',
        diseaseFilter: 'label',
        diseaseValue: 'Hepatitis',
        fields: '$limit=50&$order=mmwr_year DESC,mmwr_week DESC',
      },
    ],
  },
  malaria: {
    datasets: [
      {
        id: 't4hh-bij3',
        label: 'NNDSS Weekly Data — Malaria',
        diseaseFilter: 'label',
        diseaseValue: 'Malaria',
        fields: '$limit=50&$order=mmwr_year DESC,mmwr_week DESC',
      },
    ],
  },
  measles: {
    datasets: [
      {
        id: 't4hh-bij3',
        label: 'NNDSS Weekly Data — Measles',
        diseaseFilter: 'label',
        diseaseValue: 'Measles',
        fields: '$limit=50&$order=mmwr_year DESC,mmwr_week DESC',
      },
    ],
  },
  cholera: {
    datasets: [
      {
        id: 't4hh-bij3',
        label: 'NNDSS Weekly Data — Cholera',
        diseaseFilter: 'label',
        diseaseValue: 'Cholera',
        fields: '$limit=50&$order=mmwr_year DESC,mmwr_week DESC',
      },
    ],
  },
};

/**
 * Disease alias map for CDC dataset matching.
 */
const DISEASE_ALIASES = {
  tb: 'tuberculosis',
  'covid-19': 'covid',
  covid19: 'covid',
  coronavirus: 'covid',
  'hep b': 'hepatitis',
  'hep c': 'hepatitis',
  'hepatitis b': 'hepatitis',
  'hepatitis c': 'hepatitis',
};

/**
 * Fetch disease statistics from CDC Open Data (SODA API).
 * @param {Object} params
 * @param {string} params.disease - Disease name
 * @param {string} [params.region] - Region (CDC data is US-focused)
 * @returns {Promise<Object>} { source, data, timestamp, status }
 */
async function fetchData({ disease, region }) {
  const diseaseLower = (disease || '').toLowerCase();
  const canonicalDisease = DISEASE_ALIASES[diseaseLower] || diseaseLower;

  // Find matching datasets
  let datasetConfig = DATASET_MAP[canonicalDisease];

  // If no direct match, try NNDSS as fallback for any disease
  if (!datasetConfig) {
    datasetConfig = {
      datasets: [
        {
          id: 't4hh-bij3',
          label: `NNDSS Weekly Data — ${disease}`,
          diseaseFilter: 'label',
          diseaseValue: disease,
          fields: '$limit=50&$order=mmwr_year DESC,mmwr_week DESC',
        },
      ],
    };
  }

  const results = [];

  for (const ds of datasetConfig.datasets) {
    try {
      let url = `${BASE_URL}/${ds.id}.json?${ds.fields}`;

      // Add disease filter if applicable
      if (ds.diseaseFilter && ds.diseaseValue) {
        url += `&$where=upper(${ds.diseaseFilter}) like '%25${ds.diseaseValue.toUpperCase()}%25'`;
      }

      const response = await axios.get(url, { timeout: 10000 });

      results.push({
        dataset: ds.id,
        label: ds.label,
        recordCount: response.data.length,
        records: response.data.slice(0, 20), // Limit returned records
      });
    } catch (err) {
      results.push({
        dataset: ds.id,
        label: ds.label,
        error: err.message,
      });
    }
  }

  return {
    source: 'CDC Open Data',
    data: {
      disease: canonicalDisease,
      region: region || 'US',
      note: 'CDC data is primarily US-focused',
      datasets: results,
    },
    timestamp: new Date().toISOString(),
    status: 'ok',
  };
}

module.exports = { fetchData };
