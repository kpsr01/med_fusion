/**
 * WHO GHO OData Connector
 * Queries WHO Global Health Observatory for health indicators by country.
 * Base URL: https://ghoapi.azureedge.net/api
 * Auth: None required
 */

const axios = require('axios');

const BASE_URL = 'https://ghoapi.azureedge.net/api';

/**
 * Mapping of disease names to WHO indicator codes.
 * Each disease can have multiple relevant indicators.
 */
const DISEASE_INDICATORS = {
  malaria: [
    { code: 'MALARIA_EST_CASES', label: 'Estimated malaria cases' },
    { code: 'MALARIA_EST_DEATHS', label: 'Estimated malaria deaths' },
    { code: 'WHS3_49', label: 'Malaria incidence (per 1000 population at risk)' },
  ],
  tuberculosis: [
    { code: 'MDG_0000000020', label: 'TB incidence (per 100,000 population)' },
    { code: 'TB_e_mort_exc_tbhiv_100k', label: 'TB mortality rate (per 100,000)' },
    { code: 'TB_e_prev_100k', label: 'TB prevalence (per 100,000)' },
  ],
  hiv: [
    { code: 'HIV_0000000001', label: 'Estimated number of people living with HIV' },
    { code: 'HIV_0000000006', label: 'HIV incidence rate (per 1000 uninfected)' },
  ],
  cholera: [
    { code: 'CHOLERA_0000000001', label: 'Number of reported cholera cases' },
    { code: 'CHOLERA_0000000003', label: 'Number of reported cholera deaths' },
  ],
  measles: [
    { code: 'WHS4_129', label: 'Measles — number of reported cases' },
    { code: 'WHS8_110', label: 'Measles-containing-vaccine 1st dose coverage' },
  ],
  diabetes: [
    { code: 'NCD_BMI_30A', label: 'Prevalence of obesity among adults' },
    { code: 'NCD_GLUC_04', label: 'Raised fasting blood glucose (diabetes)' },
  ],
  hepatitis: [
    { code: 'WHS4_117', label: 'Hepatitis B surface antigen prevalence' },
  ],
  covid: [
    // WHO doesn't have COVID as standard GHO indicators — skip
  ],
};

/**
 * Map disease aliases to canonical names used in our indicator map.
 */
const DISEASE_ALIASES = {
  tb: 'tuberculosis',
  'hiv/aids': 'hiv',
  aids: 'hiv',
  flu: 'influenza',
  'hepatitis b': 'hepatitis',
  'hepatitis c': 'hepatitis',
  covid: 'covid',
  'covid-19': 'covid',
  covid19: 'covid',
  coronavirus: 'covid',
};

/**
 * Fetch health indicator data from WHO GHO OData API.
 * @param {Object} params
 * @param {string} params.disease - Disease name
 * @param {string} [params.region] - Country/region name or ISO3 code
 * @returns {Promise<Object>} { source, data, timestamp, status }
 */
async function fetchData({ disease, region, regionISO3 }) {
  const diseaseLower = (disease || '').toLowerCase();
  const canonicalDisease = DISEASE_ALIASES[diseaseLower] || diseaseLower;

  const indicators = DISEASE_INDICATORS[canonicalDisease];
  if (!indicators || indicators.length === 0) {
    return {
      source: 'WHO GHO',
      data: null,
      timestamp: new Date().toISOString(),
      status: 'skipped',
      message: `No WHO GHO indicators mapped for disease: ${disease}`,
    };
  }

  const results = [];

  for (const indicator of indicators) {
    try {
      let url = `${BASE_URL}/${indicator.code}`;
      const filters = [];

      // Filter by country ISO3 code if provided
      if (region && region !== 'global') {
        // Prefer the ISO3 code (e.g. 'IND') over the display name (e.g. 'india')
        const countryCode = regionISO3 || region.toUpperCase();
        filters.push(`SpatialDim eq '${countryCode}'`);
      }

      if (filters.length > 0) {
        url += `?$filter=${filters.join(' and ')}`;
      }

      // Add ordering to get most recent data first and limit results
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}$orderby=TimeDim desc&$top=10`;

      const response = await axios.get(url, { timeout: 10000 });
      const records = response.data.value || [];

      results.push({
        indicator: indicator.code,
        label: indicator.label,
        recordCount: records.length,
        data: records.map((r) => ({
          year: r.TimeDim,
          country: r.SpatialDim,
          value: r.NumericValue,
          displayValue: r.Value,
        })),
      });
    } catch (err) {
      results.push({
        indicator: indicator.code,
        label: indicator.label,
        error: err.message,
      });
    }
  }

  return {
    source: 'WHO GHO',
    data: {
      disease: canonicalDisease,
      region: region || 'global',
      indicators: results,
    },
    timestamp: new Date().toISOString(),
    status: 'ok',
  };
}

module.exports = { fetchData };
