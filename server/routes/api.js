const express = require('express');
const router = express.Router();
const queryEngine = require('../services/queryEngine');

// GET /api/health — Server health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// GET /api/sources — List all data sources and their status
router.get('/sources', (req, res) => {
  const sources = [
    { name: 'Disease.sh', type: 'REST API', status: 'available', description: 'COVID-19 global/country/historical data' },
    { name: 'WHO GHO', type: 'OData API', status: 'available', description: 'WHO Global Health Observatory indicators' },
    { name: 'CDC Open Data', type: 'SODA API', status: 'available', description: 'CDC disease statistics via SODA' },
    { name: 'CDC FluView', type: 'Scraping/CSV', status: 'available', description: 'CDC influenza surveillance data' },
    { name: 'HealthMap', type: 'Web Scraping', status: 'available', description: 'Outbreak alerts from HealthMap' },
    { name: 'ProMED Mail', type: 'Web Scraping', status: 'available', description: 'ProMED outbreak alert posts' },
    { name: 'IHME GHDx', type: 'Local CSV', status: 'available', description: 'India disease burden data (pre-bundled)' },
    { name: 'ECDC', type: 'CSV Download', status: 'available', description: 'European CDC surveillance data' },
    { name: 'UKHSA', type: 'REST API', status: 'available', description: 'UK Health Security Agency data' },
    { name: 'Open Targets', type: 'GraphQL', status: 'available', description: 'Gene-disease associations' },
    { name: 'PubChem', type: 'REST API', status: 'available', description: 'Drug/compound information' },
    { name: 'ICD Mapping', type: 'Static', status: 'available', description: 'ICD-10/ICD-11 disease classification' },
  ];

  res.json({
    count: sources.length,
    sources,
  });
});

// GET /api/search?disease=X&region=Y — Main unified search
router.get('/search', async (req, res) => {
  const { disease, region, sources, timeout } = req.query;

  if (!disease) {
    return res.status(400).json({
      error: 'Missing required parameter: disease',
      usage: '/api/search?disease=covid&region=india',
    });
  }

  try {
    const options = {};

    // Optional: limit to specific sources (comma-separated)
    if (sources) {
      options.sources = sources.split(',').map((s) => s.trim());
    }

    // Optional: custom timeout per connector (ms)
    if (timeout) {
      const parsed = parseInt(timeout, 10);
      if (!isNaN(parsed) && parsed > 0) {
        options.timeout = Math.min(parsed, 60000); // cap at 60s
      }
    }

    const result = await queryEngine.search({ disease, region }, options);
    res.json(result);
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({
      error: 'Search failed',
      message: err.message,
    });
  }
});

module.exports = router;
