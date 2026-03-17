/**
 * ICD-10 / ICD-11 Disease Classification Mapping
 * Static mapping of common diseases to their ICD-10 and ICD-11 codes.
 * Provides disease classification context in the unified response.
 * No external API required — uses a pre-built lookup table.
 */

/**
 * Static ICD mapping database.
 * Each entry maps a disease keyword to its ICD-10 code, ICD-11 code,
 * category, and description.
 */
const ICD_DATABASE = {
  covid: {
    icd10: 'U07.1',
    icd11: 'RA01.0',
    name: 'COVID-19',
    category: 'Infectious diseases',
    description: 'COVID-19, virus identified',
    relatedCodes: [
      { code: 'U07.2', description: 'COVID-19, virus not identified' },
      { code: 'U09.9', description: 'Post-COVID-19 condition, unspecified' },
      { code: 'U10.9', description: 'Multisystem inflammatory syndrome associated with COVID-19' },
    ],
  },
  'covid-19': { ref: 'covid' },
  covid19: { ref: 'covid' },
  coronavirus: { ref: 'covid' },
  'sars-cov-2': { ref: 'covid' },

  malaria: {
    icd10: 'B50-B54',
    icd11: '1F40-1F4Z',
    name: 'Malaria',
    category: 'Infectious diseases — Protozoal',
    description: 'Malaria caused by Plasmodium species',
    relatedCodes: [
      { code: 'B50', description: 'Plasmodium falciparum malaria' },
      { code: 'B51', description: 'Plasmodium vivax malaria' },
      { code: 'B52', description: 'Plasmodium malariae malaria' },
      { code: 'B53', description: 'Other specified malaria' },
      { code: 'B54', description: 'Unspecified malaria' },
    ],
  },

  tuberculosis: {
    icd10: 'A15-A19',
    icd11: '1B10-1B1Z',
    name: 'Tuberculosis',
    category: 'Infectious diseases — Bacterial',
    description: 'Tuberculosis caused by Mycobacterium tuberculosis',
    relatedCodes: [
      { code: 'A15', description: 'Respiratory tuberculosis' },
      { code: 'A17', description: 'Tuberculosis of nervous system' },
      { code: 'A18', description: 'Tuberculosis of other organs' },
      { code: 'A19', description: 'Miliary tuberculosis' },
    ],
  },
  tb: { ref: 'tuberculosis' },

  hiv: {
    icd10: 'B20-B24',
    icd11: '1C60-1C62.Z',
    name: 'HIV/AIDS',
    category: 'Infectious diseases — Viral',
    description: 'Human immunodeficiency virus disease',
    relatedCodes: [
      { code: 'B20', description: 'HIV disease resulting in infectious/parasitic diseases' },
      { code: 'B21', description: 'HIV disease resulting in malignant neoplasms' },
      { code: 'B22', description: 'HIV disease resulting in other specified diseases' },
      { code: 'B24', description: 'Unspecified HIV disease' },
      { code: 'Z21', description: 'Asymptomatic HIV infection status' },
    ],
  },
  aids: { ref: 'hiv' },

  influenza: {
    icd10: 'J09-J11',
    icd11: '1E30-1E32',
    name: 'Influenza',
    category: 'Diseases of the respiratory system',
    description: 'Influenza due to identified or unidentified viruses',
    relatedCodes: [
      { code: 'J09', description: 'Influenza due to identified zoonotic or pandemic virus' },
      { code: 'J10', description: 'Influenza due to other identified influenza virus' },
      { code: 'J11', description: 'Influenza due to unidentified influenza virus' },
    ],
  },
  flu: { ref: 'influenza' },

  dengue: {
    icd10: 'A90-A91',
    icd11: '1D20-1D2Z',
    name: 'Dengue',
    category: 'Infectious diseases — Viral',
    description: 'Dengue fever and dengue hemorrhagic fever',
    relatedCodes: [
      { code: 'A90', description: 'Dengue fever [classical dengue]' },
      { code: 'A91', description: 'Dengue hemorrhagic fever' },
    ],
  },

  cholera: {
    icd10: 'A00',
    icd11: '1A00',
    name: 'Cholera',
    category: 'Infectious diseases — Bacterial',
    description: 'Cholera caused by Vibrio cholerae',
    relatedCodes: [
      { code: 'A00.0', description: 'Cholera due to Vibrio cholerae 01, biovar cholerae' },
      { code: 'A00.1', description: 'Cholera due to Vibrio cholerae 01, biovar eltor' },
      { code: 'A00.9', description: 'Cholera, unspecified' },
    ],
  },

  ebola: {
    icd10: 'A98.4',
    icd11: '1D60',
    name: 'Ebola virus disease',
    category: 'Infectious diseases — Viral hemorrhagic fevers',
    description: 'Ebola virus disease (EVD)',
    relatedCodes: [
      { code: 'A98.4', description: 'Ebola virus disease' },
    ],
  },

  measles: {
    icd10: 'B05',
    icd11: '1F03',
    name: 'Measles',
    category: 'Infectious diseases — Viral',
    description: 'Measles (rubeola)',
    relatedCodes: [
      { code: 'B05.0', description: 'Measles complicated by encephalitis' },
      { code: 'B05.1', description: 'Measles complicated by meningitis' },
      { code: 'B05.2', description: 'Measles complicated by pneumonia' },
      { code: 'B05.9', description: 'Measles without complication' },
    ],
  },

  hepatitis: {
    icd10: 'B15-B19',
    icd11: '1E50-1E5Z',
    name: 'Viral hepatitis',
    category: 'Infectious diseases — Viral',
    description: 'Viral hepatitis (A, B, C, D, E)',
    relatedCodes: [
      { code: 'B15', description: 'Acute hepatitis A' },
      { code: 'B16', description: 'Acute hepatitis B' },
      { code: 'B17.1', description: 'Acute hepatitis C' },
      { code: 'B18', description: 'Chronic viral hepatitis' },
      { code: 'B19', description: 'Unspecified viral hepatitis' },
    ],
  },
  'hepatitis a': { ref: 'hepatitis' },
  'hepatitis b': { ref: 'hepatitis' },
  'hepatitis c': { ref: 'hepatitis' },

  diabetes: {
    icd10: 'E10-E14',
    icd11: '5A10-5A14',
    name: 'Diabetes mellitus',
    category: 'Endocrine, nutritional and metabolic diseases',
    description: 'Diabetes mellitus (Type 1, Type 2, and other forms)',
    relatedCodes: [
      { code: 'E10', description: 'Type 1 diabetes mellitus' },
      { code: 'E11', description: 'Type 2 diabetes mellitus' },
      { code: 'E13', description: 'Other specified diabetes mellitus' },
      { code: 'E14', description: 'Unspecified diabetes mellitus' },
    ],
  },

  cancer: {
    icd10: 'C00-C97',
    icd11: '2A00-2F9Z',
    name: 'Malignant neoplasms',
    category: 'Neoplasms',
    description: 'Malignant neoplasms (cancer)',
    relatedCodes: [
      { code: 'C34', description: 'Malignant neoplasm of bronchus and lung' },
      { code: 'C50', description: 'Malignant neoplasm of breast' },
      { code: 'C18', description: 'Malignant neoplasm of colon' },
      { code: 'C61', description: 'Malignant neoplasm of prostate' },
    ],
  },

  pneumonia: {
    icd10: 'J12-J18',
    icd11: 'CA40',
    name: 'Pneumonia',
    category: 'Diseases of the respiratory system',
    description: 'Pneumonia (viral, bacterial, and unspecified)',
    relatedCodes: [
      { code: 'J12', description: 'Viral pneumonia, not elsewhere classified' },
      { code: 'J13', description: 'Pneumonia due to Streptococcus pneumoniae' },
      { code: 'J15', description: 'Bacterial pneumonia, not elsewhere classified' },
      { code: 'J18', description: 'Pneumonia, unspecified organism' },
    ],
  },

  typhoid: {
    icd10: 'A01',
    icd11: '1A07',
    name: 'Typhoid and paratyphoid fevers',
    category: 'Infectious diseases — Bacterial',
    description: 'Typhoid fever caused by Salmonella typhi',
    relatedCodes: [
      { code: 'A01.0', description: 'Typhoid fever' },
      { code: 'A01.1', description: 'Paratyphoid fever A' },
      { code: 'A01.2', description: 'Paratyphoid fever B' },
      { code: 'A01.3', description: 'Paratyphoid fever C' },
    ],
  },

  polio: {
    icd10: 'A80',
    icd11: '1C81',
    name: 'Poliomyelitis',
    category: 'Infectious diseases — Viral',
    description: 'Acute poliomyelitis',
    relatedCodes: [
      { code: 'A80.0', description: 'Acute paralytic poliomyelitis, vaccine-associated' },
      { code: 'A80.1', description: 'Acute paralytic poliomyelitis, wild virus, imported' },
      { code: 'A80.2', description: 'Acute paralytic poliomyelitis, wild virus, indigenous' },
    ],
  },
  poliomyelitis: { ref: 'polio' },

  rabies: {
    icd10: 'A82',
    icd11: '1C82',
    name: 'Rabies',
    category: 'Infectious diseases — Viral',
    description: 'Rabies virus infection',
    relatedCodes: [
      { code: 'A82.0', description: 'Sylvatic rabies' },
      { code: 'A82.1', description: 'Urban rabies' },
      { code: 'A82.9', description: 'Rabies, unspecified' },
    ],
  },

  'yellow fever': {
    icd10: 'A95',
    icd11: '1D46',
    name: 'Yellow fever',
    category: 'Infectious diseases — Viral',
    description: 'Yellow fever',
    relatedCodes: [
      { code: 'A95.0', description: 'Sylvatic yellow fever' },
      { code: 'A95.1', description: 'Urban yellow fever' },
      { code: 'A95.9', description: 'Yellow fever, unspecified' },
    ],
  },

  plague: {
    icd10: 'A20',
    icd11: '1B93',
    name: 'Plague',
    category: 'Infectious diseases — Bacterial',
    description: 'Plague caused by Yersinia pestis',
    relatedCodes: [
      { code: 'A20.0', description: 'Bubonic plague' },
      { code: 'A20.2', description: 'Pneumonic plague' },
      { code: 'A20.7', description: 'Septicaemic plague' },
    ],
  },

  zika: {
    icd10: 'U06',
    icd11: '1D47',
    name: 'Zika virus disease',
    category: 'Infectious diseases — Viral',
    description: 'Zika virus disease',
    relatedCodes: [
      { code: 'U06.9', description: 'Zika virus disease, unspecified' },
    ],
  },

  mpox: {
    icd10: 'B04',
    icd11: '1E70',
    name: 'Mpox (Monkeypox)',
    category: 'Infectious diseases — Viral',
    description: 'Monkeypox (mpox) caused by monkeypox virus',
    relatedCodes: [
      { code: 'B04', description: 'Monkeypox' },
    ],
  },
  monkeypox: { ref: 'mpox' },

  leprosy: {
    icd10: 'A30',
    icd11: '1B20',
    name: 'Leprosy',
    category: 'Infectious diseases — Bacterial',
    description: 'Leprosy (Hansen disease)',
    relatedCodes: [
      { code: 'A30.0', description: 'Indeterminate leprosy' },
      { code: 'A30.3', description: 'Borderline leprosy' },
      { code: 'A30.5', description: 'Lepromatous leprosy' },
    ],
  },

  chikungunya: {
    icd10: 'A92.0',
    icd11: '1D20.0',
    name: 'Chikungunya virus disease',
    category: 'Infectious diseases — Viral',
    description: 'Chikungunya fever',
    relatedCodes: [
      { code: 'A92.0', description: 'Chikungunya virus disease' },
    ],
  },

  anthrax: {
    icd10: 'A22',
    icd11: '1B97',
    name: 'Anthrax',
    category: 'Infectious diseases — Bacterial',
    description: 'Anthrax caused by Bacillus anthracis',
    relatedCodes: [
      { code: 'A22.0', description: 'Cutaneous anthrax' },
      { code: 'A22.1', description: 'Pulmonary anthrax' },
      { code: 'A22.2', description: 'Gastrointestinal anthrax' },
    ],
  },
};

/**
 * Resolve a reference entry (alias) to its full data.
 * @param {string} key - Disease keyword
 * @returns {Object|null} Full ICD mapping entry or null
 */
function resolveEntry(key) {
  const entry = ICD_DATABASE[key];
  if (!entry) return null;
  if (entry.ref) return ICD_DATABASE[entry.ref] || null;
  return entry;
}

/**
 * Fetch ICD-10/ICD-11 classification data for a disease.
 * @param {Object} params
 * @param {string} params.disease - Disease name to classify
 * @param {string} [params.region] - Region (not used by this connector)
 * @returns {Promise<Object>} { source, data, timestamp, status }
 */
async function fetchData({ disease, region }) {
  if (!disease) {
    return {
      source: 'ICD Classification',
      data: null,
      timestamp: new Date().toISOString(),
      status: 'skipped',
      message: 'No disease specified',
    };
  }

  const diseaseLower = disease.toLowerCase().trim();
  const entry = resolveEntry(diseaseLower);

  if (!entry) {
    // Attempt partial matching — check if the disease keyword appears in any entry name
    const partialMatches = [];
    for (const [key, value] of Object.entries(ICD_DATABASE)) {
      if (value.ref) continue; // skip aliases
      if (
        value.name.toLowerCase().includes(diseaseLower) ||
        key.includes(diseaseLower) ||
        value.description.toLowerCase().includes(diseaseLower)
      ) {
        partialMatches.push({
          keyword: key,
          icd10: value.icd10,
          icd11: value.icd11,
          name: value.name,
          category: value.category,
          description: value.description,
        });
      }
    }

    if (partialMatches.length > 0) {
      return {
        source: 'ICD Classification',
        data: {
          searchTerm: diseaseLower,
          exactMatch: false,
          partialMatches,
        },
        timestamp: new Date().toISOString(),
        status: 'ok',
      };
    }

    return {
      source: 'ICD Classification',
      data: {
        searchTerm: diseaseLower,
        exactMatch: false,
        partialMatches: [],
        message: 'No ICD classification found for this disease',
      },
      timestamp: new Date().toISOString(),
      status: 'ok',
    };
  }

  return {
    source: 'ICD Classification',
    data: {
      searchTerm: diseaseLower,
      exactMatch: true,
      classification: {
        icd10Code: entry.icd10,
        icd11Code: entry.icd11,
        name: entry.name,
        category: entry.category,
        description: entry.description,
        relatedCodes: entry.relatedCodes,
      },
    },
    timestamp: new Date().toISOString(),
    status: 'ok',
  };
}

module.exports = { fetchData };
