/**
 * Shared utility helpers for the Disease Surveillance Dashboard.
 */

/**
 * Sanitize and lowercase a string for consistent matching.
 * @param {string} str
 * @returns {string}
 */
function normalize(str) {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Delay execution for a given number of milliseconds.
 * Useful for rate limiting.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  normalize,
  delay,
};
