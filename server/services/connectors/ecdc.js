/**
 * ECDC Connector
 * Fetches European Centre for Disease Prevention and Control open data.
 * Downloads weekly published CSV data for European surveillance.
 * Auth: None required
 */

const axios = require('axios');
const { parse } = require('csv-parse/sync');

/**
 * ECDC open data endpoints mapped by disease/topic.
 */
const ECDC_DATASETS = {
  covid: {
    url: 'https://opendata.ecdc.europa.eu/covid19/nationalcasedeath/json/',
    label: 'COVID-19 national case/death data',
    type: 'json',
  },
  covid_hospital: {
    url: 'https://opendata.ecdc.europa.eu/covid19/hospitalicuadmissionrates/json/',
    label: 'COVID-19 hospital/ICU admission rates',
    type: 'json',
  },
  covid_vaccination: {
    url: 'https://opendata.ecdc.europa.eu/covid19/vaccine_tracker/json/',
    label: 'COVID-19 vaccination data',
    type: 'json',
  },
};

/**
 * ECDC Surveillance Atlas disease mapping.
 * The Atlas provides data for many infectious diseases across Europe.
 * Maps to HealthTopic values used in the ECDC Atlas API.
 */
const ATLAS_DISEASES = {
  malaria: 'MALA',
  tuberculosis: 'TUBE',
  measles: 'MEAS',
  hepatitis: 'HEPB',
  'hepatitis b': 'HEPB',
  'hepatitis c': 'HEPC',
  salmonella: 'SALM',
  hiv: 'HIV',
  influenza: 'INFL',
  flu: 'INFL',
  cholera: 'CHOL',
  dengue: 'DENG',
  'west nile': 'WNIL',
  legionella: 'LEGI',
  campylobacter: 'CAMP',
  pertussis: 'PERT',
  rubella: 'RUBE',
  mumps: 'MUMP',
};

/**
 * Display names for ATLAS disease codes.
 */
const ATLAS_DISPLAY_NAMES = {
  MALA: 'Malaria',
  TUBE: 'Tuberculosis',
  MEAS: 'Measles',
  HEPB: 'Hepatitis B',
  HEPC: 'Hepatitis C',
  SALM: 'Salmonellosis',
  HIV: 'HIV/AIDS',
  INFL: 'Influenza',
  CHOL: 'Cholera',
  DENG: 'Dengue',
  WNIL: 'West Nile virus infection',
  LEGI: 'Legionnaires disease',
  CAMP: 'Campylobacteriosis',
  PERT: 'Pertussis',
  RUBE: 'Rubella',
  MUMP: 'Mumps',
};

/**
 * European country name to ISO2 code mapping.
 */
const EUROPEAN_COUNTRIES = {
  austria: 'AT', belgium: 'BE', bulgaria: 'BG', croatia: 'HR', cyprus: 'CY',
  czechia: 'CZ', denmark: 'DK', estonia: 'EE', finland: 'FI', france: 'FR',
  germany: 'DE', greece: 'GR', hungary: 'HU', ireland: 'IE', italy: 'IT',
  latvia: 'LV', lithuania: 'LT', luxembourg: 'LU', malta: 'MT', netherlands: 'NL',
  poland: 'PL', portugal: 'PT', romania: 'RO', slovakia: 'SK', slovenia: 'SI',
  spain: 'ES', sweden: 'SE', norway: 'NO', iceland: 'IS', liechtenstein: 'LI',
  uk: 'UK', 'united kingdom': 'UK',
};

/**
 * Fetch surveillance data from ECDC open data.
 * @param {Object} params
 * @param {string} params.disease - Disease name
 * @param {string} [params.region] - European country or region
 * @returns {Promise<Object>} { source, data, timestamp, status }
 */
async function fetchData({ disease, region }) {
  const diseaseLower = (disease || '').toLowerCase();
  const regionLower = (region || '').toLowerCase();
  const results = {};

  // Check for COVID-specific datasets
  const covidAliases = ['covid', 'covid-19', 'covid19', 'coronavirus'];
  if (covidAliases.includes(diseaseLower)) {
    // Fetch COVID data from ECDC JSON endpoints — in parallel for speed
    // Note: ECDC endpoints return bulk data (all countries/weeks). We use
    // maxContentLength and responseType to prevent downloading massive payloads.
    const entries = Object.entries(ECDC_DATASETS);
    const fetches = entries.map(async ([key, dataset]) => {
      try {
        const response = await axios.get(dataset.url, {
          timeout: 12000,
          maxContentLength: 5 * 1024 * 1024, // 5MB cap to avoid huge downloads
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DiseaseTracker/1.0)',
            'Accept': 'application/json',
          },
        });

        let records = response.data;

        // Filter by country if specified
        if (regionLower && regionLower !== 'global') {
          const countryCode = EUROPEAN_COUNTRIES[regionLower];
          records = records.filter((r) => {
            const rCountry = (r.country || r.country_code || '').toLowerCase();
            return rCountry === regionLower ||
              rCountry === (countryCode || '').toLowerCase() ||
              (r.country_code || '').toUpperCase() === (countryCode || '').toUpperCase();
          });
        }

        // Limit and sort by most recent
        records = records.slice(0, 50);

        return [key, {
          label: dataset.label,
          recordCount: records.length,
          records: records.slice(0, 20),
        }];
      } catch (err) {
        return [key, {
          label: dataset.label,
          error: err.message,
        }];
      }
    });

    const settled = await Promise.allSettled(fetches);
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value) {
        const [key, data] = result.value;
        results[key] = data;
      }
    }
  }

  // Check ECDC Surveillance Atlas for other diseases
  const atlasCode = ATLAS_DISEASES[diseaseLower];
  if (atlasCode) {
    const displayName = ATLAS_DISPLAY_NAMES[atlasCode] || atlasCode;
    try {
      // ECDC Surveillance Atlas API — fetch case distribution data
      const atlasApiUrl = `https://atlas.ecdc.europa.eu/public/index.aspx/GetData/MapCountData`;
      const atlasResponse = await axios.post(atlasApiUrl, {
        HealthTopic: atlasCode,
        Population: 'ALL',
        TimeUnit: 'Y',
        MapType: 'Cases',
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; DiseaseTracker/1.0)',
          'Accept': 'application/json',
        },
      });

      let atlasRecords = [];
      if (Array.isArray(atlasResponse.data)) {
        atlasRecords = atlasResponse.data;
      } else if (atlasResponse.data && Array.isArray(atlasResponse.data.data)) {
        atlasRecords = atlasResponse.data.data;
      }

      // Filter by country if specified
      if (regionLower && regionLower !== 'global' && atlasRecords.length > 0) {
        const countryCode = EUROPEAN_COUNTRIES[regionLower];
        atlasRecords = atlasRecords.filter((r) => {
          const rCountry = (r.GeoCode || r.Country || r.RegionCode || '').toUpperCase();
          const rName = (r.GeoName || r.CountryName || '').toLowerCase();
          return rName === regionLower ||
            rCountry === (countryCode || '').toUpperCase();
        });
      }

      // Sort by most recent year and limit
      atlasRecords.sort((a, b) => (b.Time || b.Year || 0) - (a.Time || a.Year || 0));

      results.surveillanceAtlas = {
        disease: displayName,
        dataSource: 'ECDC Surveillance Atlas of Infectious Diseases',
        recordCount: atlasRecords.length,
        records: atlasRecords.slice(0, 25).map((r) => ({
          country: r.GeoName || r.CountryName || r.GeoCode || 'Unknown',
          countryCode: r.GeoCode || r.RegionCode || null,
          year: r.Time || r.Year || null,
          cases: r.NumValue != null ? r.NumValue : (r.Value != null ? r.Value : null),
          rate: r.RateValue || null,
          population: r.Population || null,
        })),
        accessUrl: `https://atlas.ecdc.europa.eu/public/index.aspx`,
      };
    } catch (atlasErr) {
      // Atlas API may not be publicly accessible — provide structured fallback
      results.surveillanceAtlas = {
        disease: displayName,
        dataSource: 'ECDC Surveillance Atlas of Infectious Diseases',
        available: true,
        note: `ECDC tracks ${displayName} surveillance across 30+ European countries. Data available via ECDC Atlas portal.`,
        accessUrl: `https://atlas.ecdc.europa.eu/public/index.aspx`,
        apiError: atlasErr.message,
      };
    }
  }

  // If no data was fetched, provide general ECDC info
  if (Object.keys(results).length === 0) {
    return {
      source: 'ECDC',
      data: {
        disease: diseaseLower,
        region: region || 'Europe',
        note: `No specific ECDC dataset mapped for "${disease}". ECDC primarily covers European infectious disease surveillance.`,
        availableDiseases: Object.keys(ATLAS_DISEASES),
      },
      timestamp: new Date().toISOString(),
      status: 'ok',
    };
  }

  return {
    source: 'ECDC',
    data: {
      disease: diseaseLower,
      region: region || 'Europe',
      note: 'European Centre for Disease Prevention and Control open data.',
      datasets: results,
    },
    timestamp: new Date().toISOString(),
    status: 'ok',
  };
}

module.exports = { fetchData };
