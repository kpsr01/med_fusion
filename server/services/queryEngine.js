/**
 * Unified Query Engine
 *
 * Orchestrates queries across all data source connectors and enrichment
 * services in parallel, then aggregates results into a unified response.
 *
 * Flow:
 *  1. Normalize disease/region input via normalizer
 *  2. Fan-out Promise.allSettled() to all connectors
 *  3. Each connector wrapped with timeout + error isolation
 *  4. Aggregate results into unified response format
 */

const { normalizeDisease, normalizeRegion, getDiseaseAliases } = require('./normalizer');
const cacheManager = require('../cache/cacheManager');

// ---------------------------------------------------------------------------
// Data Source Connectors
// ---------------------------------------------------------------------------
const diseaseSh = require('./connectors/diseaseSh');
const whoGho = require('./connectors/whoGho');
const cdcOpen = require('./connectors/cdcOpen');
const cdcFluView = require('./connectors/cdcFluView');
const healthMap = require('./connectors/healthMap');
const promedMail = require('./connectors/promedMail');
const ihmeGhdx = require('./connectors/ihmeGhdx');
const ecdc = require('./connectors/ecdc');
const ukshaApi = require('./connectors/ukshaApi');

// ---------------------------------------------------------------------------
// Enrichment Connectors
// ---------------------------------------------------------------------------
const openTargets = require('./enrichment/openTargets');
const pubchem = require('./enrichment/pubchem');
const icdMapping = require('./enrichment/icdMapping');

// ---------------------------------------------------------------------------
// Connector registry — each entry defines a connector with its category
// ---------------------------------------------------------------------------
const CONNECTORS = [
  // Epidemiological data sources
  { name: 'Disease.sh', module: diseaseSh, category: 'epidemiological' },
  { name: 'WHO GHO', module: whoGho, category: 'epidemiological' },
  { name: 'CDC Open Data', module: cdcOpen, category: 'epidemiological' },
  { name: 'CDC FluView', module: cdcFluView, category: 'epidemiological' },
  { name: 'IHME GHDx', module: ihmeGhdx, category: 'epidemiological' },
  { name: 'ECDC', module: ecdc, category: 'epidemiological' },
  { name: 'UKHSA', module: ukshaApi, category: 'epidemiological' },

  // Outbreak alert sources
  { name: 'HealthMap', module: healthMap, category: 'outbreakAlerts' },
  { name: 'ProMED Mail', module: promedMail, category: 'outbreakAlerts' },

  // Enrichment sources
  { name: 'ICD Mapping', module: icdMapping, category: 'classification' },
  { name: 'Open Targets', module: openTargets, category: 'genomicAssociations' },
  { name: 'PubChem', module: pubchem, category: 'therapeutics' },
];

// Default timeout per connector (ms)
const DEFAULT_TIMEOUT = 15000;

// ---------------------------------------------------------------------------
// Helper: execute a single connector with timeout + error isolation
// ---------------------------------------------------------------------------
async function executeConnector(connector, params, timeoutMs = DEFAULT_TIMEOUT) {
  const start = Date.now();

  // Build cache key for this connector + query combination
  const cacheKey = cacheManager.buildCacheKey(connector.name, params);
  const ttl = cacheManager.getTTLForConnector(connector.name);

  try {
    const { data: result, cached } = await cacheManager.getOrFetch(
      cacheKey,
      async () => {
        // Actual connector call with timeout — only runs on cache miss
        return Promise.race([
          connector.module.fetchData(params),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeoutMs)
          ),
        ]);
      },
      ttl
    );

    const latency = Date.now() - start;

    return {
      name: connector.name,
      category: connector.category,
      status: result.status || 'ok',
      latency,
      data: result.data,
      message: result.message || null,
      timestamp: result.timestamp || new Date().toISOString(),
      cached,
    };
  } catch (err) {
    const latency = Date.now() - start;
    const isTimeout = err.message === 'Timeout';

    return {
      name: connector.name,
      category: connector.category,
      status: isTimeout ? 'timeout' : 'error',
      latency,
      data: null,
      message: err.message,
      timestamp: new Date().toISOString(),
      cached: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Response aggregator: groups connector results by category
// ---------------------------------------------------------------------------
function aggregateResults(connectorResults) {
  const aggregated = {
    epidemiological: {},
    outbreakAlerts: [],
    classification: {},
    genomicAssociations: {
      associations: [],
      diseaseInfo: null,
    },
    therapeutics: [],
  };

  for (const result of connectorResults) {
    // Skip connectors that returned no data
    if (!result.data && result.status !== 'ok') continue;
    if (result.status === 'skipped') continue;

    switch (result.category) {
      case 'epidemiological':
        // Each epi source gets its own key in the epidemiological object
        aggregated.epidemiological[result.name] = result.data;
        break;

      case 'outbreakAlerts':
        if (result.data) {
          // Outbreak sources may return { alerts: [...] }, { posts: [...] },
          // or a direct array. Flatten to concrete alert rows only.
          const alerts = Array.isArray(result.data.alerts)
            ? result.data.alerts
            : Array.isArray(result.data.posts)
              ? result.data.posts
              : Array.isArray(result.data)
                ? result.data
                : [];
          aggregated.outbreakAlerts.push(
            ...alerts.map((alert) => ({
              source: result.name,
              ...alert,
            }))
          );
        }
        break;

      case 'classification':
        if (result.data) {
          aggregated.classification = {
            ...aggregated.classification,
            ...result.data,
          };
        }
        break;

      case 'genomicAssociations':
        if (result.data) {
          const associations = result.data.topAssociations || result.data.associations || result.data.targets || [];
          aggregated.genomicAssociations.associations.push(
            ...associations.map((assoc) => ({
              source: result.name,
              ...assoc,
            }))
          );
          // Include disease info from Open Targets if available
          if (result.data.diseaseId || result.data.diseaseName) {
            aggregated.genomicAssociations.diseaseInfo = {
              id: result.data.diseaseId,
              name: result.data.diseaseName,
            };
          }
        }
        break;

      case 'therapeutics':
        if (result.data) {
          const compounds = Array.isArray(result.data.compounds)
            ? result.data.compounds
            : Array.isArray(result.data)
              ? result.data
              : [result.data];
          aggregated.therapeutics.push(
            ...compounds.map((compound) => ({
              source: result.name,
              ...compound,
            }))
          );
        }
        break;

      default:
        break;
    }
  }

  return aggregated;
}

// ---------------------------------------------------------------------------
// Build source status summary
// ---------------------------------------------------------------------------

/**
 * Compute trend analysis from epidemiological time-series data.
 * Analyzes Disease.sh timeline and IHME multi-year records to produce
 * rate-of-change metrics and trend direction.
 */
function computeTrends(epidemiological) {
  const trends = {};

  // --- Disease.sh timeline trends (daily cumulative → daily new cases) ---
  const diseaseSh = epidemiological['Disease.sh'];
  if (diseaseSh && diseaseSh.historical && diseaseSh.historical.timeline) {
    const timeline = diseaseSh.historical.timeline;

    for (const metric of ['cases', 'deaths', 'recovered']) {
      if (!timeline[metric]) continue;

      const dates = Object.keys(timeline[metric]);
      const values = dates.map((d) => timeline[metric][d]);

      if (values.length < 2) continue;

      // Compute daily new counts from cumulative
      const dailyNew = [];
      for (let i = 1; i < values.length; i++) {
        dailyNew.push(Math.max(0, values[i] - values[i - 1]));
      }

      // Simple moving average (7-day) for smoothing
      const windowSize = Math.min(7, dailyNew.length);
      const recentWindow = dailyNew.slice(-windowSize);
      const recentAvg = recentWindow.reduce((s, v) => s + v, 0) / recentWindow.length;

      // Compare recent week to prior week for trend direction
      let trendDirection = 'stable';
      let percentChange = 0;
      if (dailyNew.length >= windowSize * 2) {
        const priorWindow = dailyNew.slice(-(windowSize * 2), -windowSize);
        const priorAvg = priorWindow.reduce((s, v) => s + v, 0) / priorWindow.length;
        if (priorAvg > 0) {
          percentChange = ((recentAvg - priorAvg) / priorAvg) * 100;
          if (percentChange > 5) trendDirection = 'increasing';
          else if (percentChange < -5) trendDirection = 'decreasing';
          else trendDirection = 'stable';
        } else if (recentAvg > 0) {
          trendDirection = 'increasing';
          percentChange = 100;
        }
      }

      const totalChange = values[values.length - 1] - values[0];

      trends[`diseaseSh_${metric}`] = {
        source: 'Disease.sh',
        metric,
        period: `${dates[0]} – ${dates[dates.length - 1]}`,
        dataPoints: values.length,
        totalChange,
        dailyAverage: Math.round(recentAvg),
        trendDirection,
        weekOverWeekChange: Math.round(percentChange * 10) / 10,
      };
    }
  }

  // --- IHME multi-year trends ---
  const ihme = epidemiological['IHME GHDx'];
  if (ihme && Array.isArray(ihme.records) && ihme.records.length > 1) {
    // Group records by measure (e.g., Deaths, DALYs, Prevalence)
    const byMeasure = {};
    for (const rec of ihme.records) {
      const key = rec.measure || 'unknown';
      if (!byMeasure[key]) byMeasure[key] = [];
      byMeasure[key].push(rec);
    }

    for (const [measure, records] of Object.entries(byMeasure)) {
      // Sort by year
      const sorted = records
        .filter((r) => r.year && r.value != null && !isNaN(r.value))
        .sort((a, b) => Number(a.year) - Number(b.year));

      if (sorted.length < 2) continue;

      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalChange = last.value - first.value;
      const yearSpan = Number(last.year) - Number(first.year);
      const annualRate = yearSpan > 0 ? totalChange / yearSpan : 0;

      let trendDirection = 'stable';
      if (yearSpan > 0) {
        const pctChange = first.value !== 0 ? (totalChange / Math.abs(first.value)) * 100 : 0;
        if (pctChange > 5) trendDirection = 'increasing';
        else if (pctChange < -5) trendDirection = 'decreasing';
      }

      const measureKey = measure.toLowerCase().replace(/\s+/g, '_');
      trends[`ihme_${measureKey}`] = {
        source: 'IHME GHDx',
        metric: measure,
        period: `${first.year} – ${last.year}`,
        dataPoints: sorted.length,
        startValue: Math.round(first.value * 100) / 100,
        endValue: Math.round(last.value * 100) / 100,
        totalChange: Math.round(totalChange * 100) / 100,
        annualRateOfChange: Math.round(annualRate * 100) / 100,
        trendDirection,
      };
    }
  }

  return Object.keys(trends).length > 0 ? trends : null;
}

function buildSourcesSummary(connectorResults) {
  return connectorResults.map((result) => ({
    name: result.name,
    status: result.status,
    latency: result.latency,
    message: result.message,
    cached: result.cached || false,
  }));
}

// ---------------------------------------------------------------------------
// Main query function
// ---------------------------------------------------------------------------

/**
 * Execute a unified search across all data sources.
 *
 * @param {Object} params
 * @param {string} params.disease - Disease name (raw user input)
 * @param {string} [params.region] - Region name (raw user input)
 * @param {Object} [options]
 * @param {number} [options.timeout] - Per-connector timeout in ms
 * @param {string[]} [options.sources] - Limit to specific source names
 * @returns {Promise<Object>} Unified response
 */
async function search({ disease, region }, options = {}) {
  const startTime = Date.now();
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  // Step 1: Normalize inputs
  const normalizedDisease = normalizeDisease(disease);
  const normalizedRegion = normalizeRegion(region);
  const aliases = getDiseaseAliases(normalizedDisease);

  // Build connector params — connectors receive both canonical + raw forms
  const connectorParams = {
    disease: normalizedDisease,
    diseaseRaw: disease,
    diseaseAliases: aliases,
    region: normalizedRegion.name,
    regionISO3: normalizedRegion.iso3,
    regionRaw: region,
  };

  // Step 2: Determine which connectors to run
  let connectorsToRun = CONNECTORS;
  if (options.sources && options.sources.length > 0) {
    const sourceFilter = options.sources.map((s) => s.toLowerCase());
    connectorsToRun = CONNECTORS.filter((c) =>
      sourceFilter.includes(c.name.toLowerCase())
    );
  }

  // Step 3: Fan-out to all connectors in parallel
  const connectorPromises = connectorsToRun.map((connector) =>
    executeConnector(connector, connectorParams, timeout)
  );

  const results = await Promise.allSettled(connectorPromises);

  // Extract fulfilled results (rejected promises should not happen due to
  // error isolation in executeConnector, but handle defensively)
  const connectorResults = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    // This should not normally occur since executeConnector catches all errors
    return {
      name: connectorsToRun[index].name,
      category: connectorsToRun[index].category,
      status: 'error',
      latency: 0,
      data: null,
      message: result.reason?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  });

  // Step 4: Aggregate results by category
  const aggregatedResults = aggregateResults(connectorResults);

  // Step 4b: Compute trend analysis from epidemiological time-series data
  const trendAnalysis = computeTrends(aggregatedResults.epidemiological);
  if (trendAnalysis) {
    aggregatedResults.trendAnalysis = trendAnalysis;
  }

  // Step 5: Build source status summary
  const sourcesSummary = buildSourcesSummary(connectorResults);

  const totalLatency = Date.now() - startTime;

  // Step 6: Return unified response
  return {
    query: {
      disease: normalizedDisease,
      diseaseRaw: disease,
      region: normalizedRegion.name,
      regionISO3: normalizedRegion.iso3,
      aliases,
    },
    timestamp: new Date().toISOString(),
    totalLatency,
    results: aggregatedResults,
    sources: sourcesSummary,
    summary: {
      totalSources: connectorResults.length,
      successful: connectorResults.filter((r) => r.status === 'ok').length,
      skipped: connectorResults.filter((r) => r.status === 'skipped').length,
      failed: connectorResults.filter(
        (r) => r.status === 'error' || r.status === 'timeout'
      ).length,
      cachedResponses: connectorResults.filter((r) => r.cached).length,
    },
    cache: cacheManager.getStats(),
  };
}

module.exports = { search, CONNECTORS, cacheManager };
