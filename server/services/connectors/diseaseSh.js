/**
 * Disease.sh Connector
 * REST API — COVID-19 global, country, and historical data.
 * Base URL: https://disease.sh/v3/covid-19
 * Auth: None required
 */

const axios = require('axios');

const BASE_URL = 'https://disease.sh/v3/covid-19';

/**
 * Fetch COVID-19 data from Disease.sh API.
 * @param {Object} params
 * @param {string} params.disease - Disease name (currently COVID-focused)
 * @param {string} [params.region] - Country/region name
 * @returns {Promise<Object>} { source, data, timestamp, status }
 */
async function fetchData({ disease, region }) {
  const diseaseLower = (disease || '').toLowerCase();

  // Disease.sh is COVID-specific — only respond to COVID-related queries
  const covidAliases = ['covid', 'covid-19', 'covid19', 'coronavirus', 'sars-cov-2'];
  if (!covidAliases.includes(diseaseLower)) {
    return {
      source: 'Disease.sh',
      data: null,
      timestamp: new Date().toISOString(),
      status: 'skipped',
      message: 'Disease.sh only provides COVID-19 data',
    };
  }

  const results = {};

  // Fetch global stats
  try {
    const globalRes = await axios.get(`${BASE_URL}/all`, { timeout: 10000 });
    results.global = {
      cases: globalRes.data.cases,
      todayCases: globalRes.data.todayCases,
      deaths: globalRes.data.deaths,
      todayDeaths: globalRes.data.todayDeaths,
      recovered: globalRes.data.recovered,
      active: globalRes.data.active,
      critical: globalRes.data.critical,
      casesPerOneMillion: globalRes.data.casesPerOneMillion,
      deathsPerOneMillion: globalRes.data.deathsPerOneMillion,
      tests: globalRes.data.tests,
      population: globalRes.data.population,
      updated: globalRes.data.updated,
    };
  } catch (err) {
    results.global = { error: err.message };
  }

  // Fetch all-country snapshot for choropleth and comparison views
  try {
    const countriesRes = await axios.get(`${BASE_URL}/countries`, { timeout: 10000 });
    results.countries = Array.isArray(countriesRes.data)
      ? countriesRes.data.map((item) => ({
          country: item.country,
          countryInfo: item.countryInfo
            ? {
                iso2: item.countryInfo.iso2,
                iso3: item.countryInfo.iso3,
                lat: item.countryInfo.lat,
                long: item.countryInfo.long,
              }
            : null,
          cases: item.cases,
          todayCases: item.todayCases,
          deaths: item.deaths,
          todayDeaths: item.todayDeaths,
          recovered: item.recovered,
          active: item.active,
          critical: item.critical,
          casesPerOneMillion: item.casesPerOneMillion,
          deathsPerOneMillion: item.deathsPerOneMillion,
          tests: item.tests,
          population: item.population,
          updated: item.updated,
        }))
      : [];
  } catch (err) {
    results.countries = [];
    results.countriesError = err.message;
  }

  // Fetch country-specific data if region is provided
  if (region && region !== 'global') {
    try {
      const countryRes = await axios.get(`${BASE_URL}/countries/${encodeURIComponent(region)}`, {
        timeout: 10000,
      });
      results.country = {
        country: countryRes.data.country,
        countryCode: countryRes.data.countryInfo?.iso3,
        cases: countryRes.data.cases,
        todayCases: countryRes.data.todayCases,
        deaths: countryRes.data.deaths,
        todayDeaths: countryRes.data.todayDeaths,
        recovered: countryRes.data.recovered,
        active: countryRes.data.active,
        critical: countryRes.data.critical,
        casesPerOneMillion: countryRes.data.casesPerOneMillion,
        deathsPerOneMillion: countryRes.data.deathsPerOneMillion,
        tests: countryRes.data.tests,
        population: countryRes.data.population,
      };
    } catch (err) {
      results.country = { error: err.message };
    }

    // Fetch historical data (last 30 days)
    try {
      const histRes = await axios.get(
        `${BASE_URL}/historical/${encodeURIComponent(region)}?lastdays=30`,
        { timeout: 10000 }
      );
      results.historical = {
        country: histRes.data.country,
        timeline: histRes.data.timeline,
      };
    } catch (err) {
      results.historical = { error: err.message };
    }
  }

  return {
    source: 'Disease.sh',
    data: results,
    timestamp: new Date().toISOString(),
    status: 'ok',
  };
}

module.exports = { fetchData };
