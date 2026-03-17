/**
 * PubChem PUG-REST Connector
 * Fetches drug/compound information related to a disease.
 * Base URL: https://pubchem.ncbi.nlm.nih.gov/rest/pug
 * Auth: None required
 * Rate limit: max 5 requests/sec
 */

const axios = require('axios');
const { delay } = require('../../utils/helpers');

const BASE_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const PUG_VIEW_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view';

/**
 * WHO Essential Medicines List (EML) — common drugs that appear on the list.
 * Source: WHO Model List of Essential Medicines, 23rd List (2023)
 */
const WHO_ESSENTIAL_MEDICINES = new Set([
  'chloroquine', 'artemisinin', 'primaquine', 'mefloquine',
  'isoniazid', 'rifampicin', 'ethambutol', 'pyrazinamide',
  'tenofovir', 'emtricitabine', 'dolutegravir', 'efavirenz',
  'oseltamivir', 'amantadine',
  'doxycycline', 'azithromycin', 'ciprofloxacin', 'ceftriaxone',
  'amoxicillin', 'levofloxacin', 'metformin', 'insulin',
  'cisplatin', 'doxorubicin', 'paclitaxel', 'imatinib',
  'acetaminophen', 'vitamin a', 'sofosbuvir', 'ledipasvir',
  'entecavir', 'dexamethasone', 'remdesivir',
]);

/**
 * Mapping of common diseases to representative drug/compound names.
 * Used to search PubChem for relevant therapeutics.
 */
const DISEASE_DRUG_MAP = {
  covid: ['remdesivir', 'paxlovid', 'molnupiravir', 'dexamethasone'],
  'covid-19': ['remdesivir', 'paxlovid', 'molnupiravir', 'dexamethasone'],
  covid19: ['remdesivir', 'paxlovid', 'molnupiravir', 'dexamethasone'],
  coronavirus: ['remdesivir', 'paxlovid', 'molnupiravir', 'dexamethasone'],
  malaria: ['chloroquine', 'artemisinin', 'mefloquine', 'primaquine'],
  tuberculosis: ['isoniazid', 'rifampicin', 'ethambutol', 'pyrazinamide'],
  tb: ['isoniazid', 'rifampicin', 'ethambutol', 'pyrazinamide'],
  hiv: ['tenofovir', 'emtricitabine', 'dolutegravir', 'efavirenz'],
  aids: ['tenofovir', 'emtricitabine', 'dolutegravir', 'efavirenz'],
  influenza: ['oseltamivir', 'zanamivir', 'baloxavir', 'amantadine'],
  flu: ['oseltamivir', 'zanamivir', 'baloxavir', 'amantadine'],
  dengue: ['acetaminophen', 'dengvaxia'],
  cholera: ['doxycycline', 'azithromycin', 'oral rehydration salts'],
  ebola: ['inmazeb', 'ebanga', 'remdesivir'],
  measles: ['vitamin a', 'mmr vaccine'],
  hepatitis: ['sofosbuvir', 'ledipasvir', 'tenofovir', 'entecavir'],
  diabetes: ['metformin', 'insulin', 'glipizide', 'sitagliptin'],
  cancer: ['cisplatin', 'doxorubicin', 'paclitaxel', 'imatinib'],
  pneumonia: ['amoxicillin', 'azithromycin', 'levofloxacin'],
  typhoid: ['ciprofloxacin', 'azithromycin', 'ceftriaxone'],
};

/**
 * Search PubChem for a compound by name and return its properties.
 * @param {string} compoundName - Name of the compound/drug
 * @returns {Promise<Object|null>} Compound info or null
 */
async function fetchCompoundInfo(compoundName) {
  try {
    // Get CID by compound name
    const searchRes = await axios.get(
      `${BASE_URL}/compound/name/${encodeURIComponent(compoundName)}/cids/JSON`,
      { timeout: 10000 }
    );

    const cids = searchRes.data?.IdentifierList?.CID;
    if (!cids || cids.length === 0) return null;

    const cid = cids[0];

    // Respect rate limit
    await delay(250);

    // Fetch compound properties
    const propsRes = await axios.get(
      `${BASE_URL}/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,IsomericSMILES,InChIKey/JSON`,
      { timeout: 10000 }
    );

    const props = propsRes.data?.PropertyTable?.Properties?.[0] || {};

    // Respect rate limit
    await delay(250);

    // Fetch synonyms (top 5)
    let synonyms = [];
    try {
      const synRes = await axios.get(
        `${BASE_URL}/compound/cid/${cid}/synonyms/JSON`,
        { timeout: 10000 }
      );
      synonyms = (synRes.data?.InformationList?.Information?.[0]?.Synonym || []).slice(0, 5);
    } catch {
      // Synonyms are non-critical
    }

    // Respect rate limit
    await delay(250);

    // Fetch compound description — includes pharmacological action & mechanism of action
    let description = null;
    let mechanismOfAction = null;
    let indication = null;
    try {
      const descRes = await axios.get(
        `${BASE_URL}/compound/cid/${cid}/description/JSON`,
        { timeout: 10000 }
      );
      const descriptions = descRes.data?.InformationList?.Information || [];
      for (const info of descriptions) {
        if (info.Description) {
          // Use first substantial description
          if (!description && info.Description.length > 20) {
            description = info.Description;
          }
          // Look for mechanism/pharmacology keywords
          const descLower = info.Description.toLowerCase();
          if (!mechanismOfAction && (descLower.includes('mechanism') || descLower.includes('acts by') ||
              descLower.includes('inhibit') || descLower.includes('blocks') ||
              descLower.includes('binds to') || descLower.includes('antagonist') ||
              descLower.includes('agonist') || descLower.includes('interferes'))) {
            mechanismOfAction = info.Description;
          }
          if (!indication && (descLower.includes('used for') || descLower.includes('treatment of') ||
              descLower.includes('indicated') || descLower.includes('used to treat') ||
              descLower.includes('used in the treatment'))) {
            indication = info.Description;
          }
        }
      }
      // If no specific mechanism found, use the first description as a general description
      if (!mechanismOfAction && description) {
        mechanismOfAction = description;
      }
    } catch {
      // Description fetch is non-critical
    }

    // Check WHO Essential Medicines List status
    const whoEssentialMedicine = WHO_ESSENTIAL_MEDICINES.has(compoundName.toLowerCase());

    return {
      cid,
      name: compoundName,
      molecularFormula: props.MolecularFormula || null,
      molecularWeight: props.MolecularWeight || null,
      iupacName: props.IUPACName || null,
      smiles: props.CanonicalSMILES || null,
      inchiKey: props.InChIKey || null,
      synonyms,
      description: description || null,
      mechanismOfAction: mechanismOfAction || null,
      indication: indication || null,
      whoEssentialMedicine,
      pubchemUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
    };
  } catch (err) {
    // Compound not found or API error — return null
    return null;
  }
}

/**
 * Fetch drug/compound information from PubChem related to a disease.
 * @param {Object} params
 * @param {string} params.disease - Disease name to look up related drugs
 * @param {string} [params.region] - Region (not used by this connector)
 * @returns {Promise<Object>} { source, data, timestamp, status }
 */
async function fetchData({ disease, region }) {
  if (!disease) {
    return {
      source: 'PubChem',
      data: null,
      timestamp: new Date().toISOString(),
      status: 'skipped',
      message: 'No disease specified',
    };
  }

  const diseaseLower = disease.toLowerCase().trim();
  const drugs = DISEASE_DRUG_MAP[diseaseLower];

  if (!drugs || drugs.length === 0) {
    return {
      source: 'PubChem',
      data: {
        disease: diseaseLower,
        compounds: [],
        message: 'No known drug mappings for this disease in our database',
      },
      timestamp: new Date().toISOString(),
      status: 'ok',
    };
  }

  try {
    // Fetch compound info for each mapped drug (sequentially to respect rate limit)
    const compounds = [];
    for (const drug of drugs) {
      const info = await fetchCompoundInfo(drug);
      if (info) {
        compounds.push(info);
      }
      // Additional rate limit spacing between compounds
      await delay(200);
    }

    return {
      source: 'PubChem',
      data: {
        disease: diseaseLower,
        relatedDrugs: drugs,
        compounds,
        totalFound: compounds.length,
      },
      timestamp: new Date().toISOString(),
      status: 'ok',
    };
  } catch (err) {
    return {
      source: 'PubChem',
      data: null,
      timestamp: new Date().toISOString(),
      status: 'error',
      message: err.message,
    };
  }
}

module.exports = { fetchData };
