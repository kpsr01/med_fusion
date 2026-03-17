/**
 * Open Targets GraphQL Connector
 * Fetches gene-disease associations via the Open Targets Platform API.
 * Endpoint: https://api.platform.opentargets.org/api/v4/graphql
 * Auth: None required
 */

const axios = require('axios');

const ENDPOINT = 'https://api.platform.opentargets.org/api/v4/graphql';

/**
 * GraphQL query to search for a disease and retrieve associated targets (genes).
 */
const DISEASE_SEARCH_QUERY = `
  query DiseaseSearch($queryString: String!) {
    search(queryString: $queryString, entityNames: ["disease"], page: { index: 0, size: 5 }) {
      total
      hits {
        id
        name
        entity
        description
      }
    }
  }
`;

/**
 * GraphQL query to fetch associated targets for a given disease EFO ID.
 */
const DISEASE_TARGETS_QUERY = `
  query DiseaseTargets($efoId: String!) {
    disease(efoId: $efoId) {
      id
      name
      description
      associatedTargets(page: { index: 0, size: 10 }) {
        count
        rows {
          target {
            id
            approvedSymbol
            approvedName
          }
          score
          datatypeScores {
            id
            score
          }
        }
      }
    }
  }
`;

/**
 * Execute a GraphQL query against Open Targets API.
 * @param {string} query - GraphQL query string
 * @param {Object} variables - Query variables
 * @returns {Promise<Object>} Response data
 */
async function graphqlRequest(query, variables) {
  const res = await axios.post(
    ENDPOINT,
    { query, variables },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    }
  );
  if (res.data.errors) {
    throw new Error(res.data.errors.map((e) => e.message).join('; '));
  }
  return res.data.data;
}

/**
 * Fetch gene-disease associations from Open Targets.
 * @param {Object} params
 * @param {string} params.disease - Disease name to search
 * @param {string} [params.region] - Region (not used by this connector)
 * @returns {Promise<Object>} { source, data, timestamp, status }
 */
async function fetchData({ disease, region }) {
  if (!disease) {
    return {
      source: 'Open Targets',
      data: null,
      timestamp: new Date().toISOString(),
      status: 'skipped',
      message: 'No disease specified',
    };
  }

  try {
    // Step 1: Search for the disease to get its EFO ID
    const searchData = await graphqlRequest(DISEASE_SEARCH_QUERY, {
      queryString: disease,
    });

    const hits = searchData.search?.hits || [];
    if (hits.length === 0) {
      return {
        source: 'Open Targets',
        data: { searchTerm: disease, matches: [] },
        timestamp: new Date().toISOString(),
        status: 'ok',
        message: 'No matching diseases found in Open Targets',
      };
    }

    // Use the top hit's EFO ID
    const topHit = hits[0];
    const efoId = topHit.id;

    // Step 2: Fetch associated targets (genes) for this disease
    const targetData = await graphqlRequest(DISEASE_TARGETS_QUERY, {
      efoId,
    });

    const diseaseInfo = targetData.disease;
    const associations = (diseaseInfo?.associatedTargets?.rows || []).map((row) => ({
      geneSymbol: row.target.approvedSymbol,
      geneName: row.target.approvedName,
      targetId: row.target.id,
      overallScore: row.score,
      evidenceScores: (row.datatypeScores || []).reduce((acc, dt) => {
        acc[dt.id] = dt.score;
        return acc;
      }, {}),
    }));

    return {
      source: 'Open Targets',
      data: {
        diseaseId: diseaseInfo?.id,
        diseaseName: diseaseInfo?.name,
        description: diseaseInfo?.description,
        totalAssociatedTargets: diseaseInfo?.associatedTargets?.count || 0,
        topAssociations: associations,
        searchHits: hits.map((h) => ({
          id: h.id,
          name: h.name,
          description: h.description,
        })),
      },
      timestamp: new Date().toISOString(),
      status: 'ok',
    };
  } catch (err) {
    return {
      source: 'Open Targets',
      data: null,
      timestamp: new Date().toISOString(),
      status: 'error',
      message: err.message,
    };
  }
}

module.exports = { fetchData };
