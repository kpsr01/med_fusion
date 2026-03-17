/**
 * IHME GHDx Connector
 * Parses pre-bundled CSV with India disease burden data.
 * No API available — uses csv-parse on local data file.
 * Auth: N/A (offline data)
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const CSV_PATH = path.join(__dirname, '..', '..', 'data', 'ihme_india_sample.csv');

/**
 * Disease name matching patterns for CSV filtering.
 */
const DISEASE_PATTERNS = {
  malaria: ['malaria'],
  tuberculosis: ['tuberculosis', 'tb'],
  hiv: ['hiv', 'hiv/aids'],
  diabetes: ['diabetes'],
  cholera: ['diarrheal', 'diarrhea', 'cholera'],
  measles: ['measles'],
  hepatitis: ['hepatitis'],
  dengue: ['dengue'],
  typhoid: ['typhoid'],
  covid: ['covid', 'coronavirus', 'sars'],
  respiratory: ['respiratory', 'lower respiratory', 'upper respiratory'],
  cardiovascular: ['cardiovascular', 'ischemic heart', 'stroke'],
  cancer: ['neoplasm', 'cancer', 'tumor'],
  neonatal: ['neonatal'],
  nutritional: ['nutritional', 'malnutrition', 'iron deficiency'],
  influenza: ['influenza', 'flu'],
};

/**
 * Fetch disease burden data from pre-bundled IHME India CSV.
 * @param {Object} params
 * @param {string} params.disease - Disease name to filter by
 * @param {string} [params.region] - Region (IHME data is India-focused)
 * @returns {Promise<Object>} { source, data, timestamp, status }
 */
async function fetchData({ disease, region }) {
  const diseaseLower = (disease || '').toLowerCase();
  const regionLower = (region || '').toLowerCase();

  // IHME data is India-specific — check relevance
  const indiaAliases = ['india', 'ind', 'in', 'global', ''];
  const isRelevantRegion = !regionLower || indiaAliases.includes(regionLower);

  if (!isRelevantRegion) {
    return {
      source: 'IHME GHDx',
      data: null,
      timestamp: new Date().toISOString(),
      status: 'skipped',
      message: 'IHME GHDx connector only has pre-bundled data for India',
    };
  }

  // Check if CSV file exists
  if (!fs.existsSync(CSV_PATH)) {
    return {
      source: 'IHME GHDx',
      data: null,
      timestamp: new Date().toISOString(),
      status: 'error',
      error: 'IHME data file not found. Expected at: server/data/ihme_india_sample.csv',
    };
  }

  try {
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    // Find matching disease patterns
    const patterns = DISEASE_PATTERNS[diseaseLower] || [diseaseLower];

    // Filter records by disease name match
    const matchedRecords = records.filter((row) => {
      const cause = (row.cause_name || row.cause || row.disease || '').toLowerCase();
      return patterns.some((p) => cause.includes(p));
    });

    // Extract relevant metrics
    const formattedRecords = matchedRecords.map((row) => ({
      cause: row.cause_name || row.cause || row.disease,
      year: row.year,
      metric: row.metric_name || row.metric,
      value: parseFloat(row.val || row.value || 0),
      upper: parseFloat(row.upper || 0),
      lower: parseFloat(row.lower || 0),
      measure: row.measure_name || row.measure,
      sex: row.sex_name || row.sex,
      age: row.age_name || row.age,
      location: row.location_name || row.location || 'India',
    }));

    return {
      source: 'IHME GHDx',
      data: {
        disease: diseaseLower,
        region: 'India',
        recordCount: formattedRecords.length,
        records: formattedRecords.slice(0, 50), // Limit output
        note: 'Pre-bundled IHME Global Burden of Disease data for India. Metrics include DALYs, prevalence, incidence, and deaths.',
        dataYear: 'Various (2000-2021)',
      },
      timestamp: new Date().toISOString(),
      status: 'ok',
    };
  } catch (err) {
    return {
      source: 'IHME GHDx',
      data: null,
      timestamp: new Date().toISOString(),
      status: 'error',
      error: `Failed to parse IHME data: ${err.message}`,
    };
  }
}

module.exports = { fetchData };
