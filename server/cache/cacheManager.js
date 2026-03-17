/**
 * Cache Manager
 *
 * Wraps node-cache with a convenient getOrFetch() pattern.
 * Each connector gets its own cache key namespace to avoid collisions.
 *
 * Key format: {connector}:{disease}:{region}
 * Default TTL: 10 minutes (600 seconds)
 */

const NodeCache = require('node-cache');

// Default TTL in seconds (10 minutes)
const DEFAULT_TTL = 600;

// Per-connector TTL overrides (in seconds)
// Sources that update less frequently can have longer TTLs;
// scraped/volatile sources get shorter TTLs.
const CONNECTOR_TTL = {
  'Disease.sh':     600,   // 10 min — REST API, moderate update freq
  'WHO GHO':        1800,  // 30 min — OData, infrequent updates
  'CDC Open Data':  1200,  // 20 min — SODA API, weekly updates
  'CDC FluView':    1800,  // 30 min — weekly data
  'HealthMap':      300,   // 5 min  — scraped, may change often
  'ProMED Mail':    300,   // 5 min  — scraped, may change often
  'IHME GHDx':      3600,  // 60 min — local CSV, static data
  'ECDC':           1800,  // 30 min — weekly published CSVs
  'UKHSA':          1200,  // 20 min — REST API
  'ICD Mapping':    86400, // 24 hr  — static mapping, rarely changes
  'Open Targets':   1800,  // 30 min — GraphQL, stable data
  'PubChem':        1800,  // 30 min — REST API, stable data
};

// Create the cache instance
const cache = new NodeCache({
  stdTTL: DEFAULT_TTL,
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false,  // Return references for performance (safe since we don't mutate)
});

// ---------------------------------------------------------------------------
// Cache key generation
// ---------------------------------------------------------------------------

/**
 * Build a normalized cache key for a connector query.
 *
 * @param {string} connectorName - Name of the connector (e.g. "Disease.sh")
 * @param {Object} params - Query parameters
 * @param {string} params.disease - Normalized disease name
 * @param {string} [params.region] - Normalized region name
 * @returns {string} Cache key
 */
function buildCacheKey(connectorName, params) {
  const disease = (params.disease || 'all').toLowerCase().trim();
  const region = (params.region || 'global').toLowerCase().trim();
  return `${connectorName}:${disease}:${region}`;
}

// ---------------------------------------------------------------------------
// Core cache operations
// ---------------------------------------------------------------------------

/**
 * Get a cached value, or fetch it using the provided function if not cached.
 * This is the primary interface for connectors to use caching.
 *
 * @param {string} key - Cache key (use buildCacheKey to generate)
 * @param {Function} fetchFn - Async function that returns fresh data
 * @param {number} [ttl] - TTL in seconds (overrides default)
 * @returns {Promise<{ data: any, cached: boolean }>}
 */
async function getOrFetch(key, fetchFn, ttl) {
  // Check cache first
  const cached = cache.get(key);
  if (cached !== undefined) {
    return { data: cached, cached: true };
  }

  // Cache miss — execute the fetch function
  const freshData = await fetchFn();

  // Store in cache with specified TTL (or default)
  if (freshData !== undefined && freshData !== null) {
    cache.set(key, freshData, ttl || DEFAULT_TTL);
  }

  return { data: freshData, cached: false };
}

/**
 * Get a value from cache. Returns undefined on miss.
 *
 * @param {string} key
 * @returns {any|undefined}
 */
function get(key) {
  return cache.get(key);
}

/**
 * Set a value in cache.
 *
 * @param {string} key
 * @param {any} value
 * @param {number} [ttl] - TTL in seconds
 */
function set(key, value, ttl) {
  cache.set(key, value, ttl || DEFAULT_TTL);
}

/**
 * Delete a specific key from cache.
 *
 * @param {string} key
 * @returns {number} Number of deleted keys
 */
function del(key) {
  return cache.del(key);
}

/**
 * Flush the entire cache.
 */
function flush() {
  cache.flushAll();
}

/**
 * Get cache statistics.
 *
 * @returns {Object} { keys, hits, misses, hitRate }
 */
function getStats() {
  const stats = cache.getStats();
  const totalRequests = stats.hits + stats.misses;
  return {
    keys: cache.keys().length,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: totalRequests > 0
      ? ((stats.hits / totalRequests) * 100).toFixed(1) + '%'
      : '0%',
  };
}

/**
 * Get the TTL for a specific connector.
 *
 * @param {string} connectorName
 * @returns {number} TTL in seconds
 */
function getTTLForConnector(connectorName) {
  return CONNECTOR_TTL[connectorName] || DEFAULT_TTL;
}

module.exports = {
  buildCacheKey,
  getOrFetch,
  get,
  set,
  del,
  flush,
  getStats,
  getTTLForConnector,
  CONNECTOR_TTL,
  DEFAULT_TTL,
};
