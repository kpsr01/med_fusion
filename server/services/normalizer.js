/**
 * Disease and Region name normalization.
 *
 * Provides:
 *  - Disease alias mapping (e.g. "flu" -> "influenza")
 *  - Region name -> ISO-3166 alpha-3 code mapping
 */

// ---------------------------------------------------------------------------
// Disease aliases — map common shorthand / alternate names to canonical form
// ---------------------------------------------------------------------------
const DISEASE_ALIASES = {
  // Influenza variants
  flu: 'influenza',
  'the flu': 'influenza',
  'seasonal flu': 'influenza',
  'h1n1': 'influenza',
  'h5n1': 'influenza',
  'avian flu': 'influenza',
  'bird flu': 'influenza',
  'swine flu': 'influenza',

  // Tuberculosis
  tb: 'tuberculosis',
  'consumption': 'tuberculosis',

  // COVID variants
  covid: 'covid-19',
  'covid19': 'covid-19',
  'sars-cov-2': 'covid-19',
  'sarscov2': 'covid-19',
  coronavirus: 'covid-19',
  corona: 'covid-19',
  'novel coronavirus': 'covid-19',

  // HIV / AIDS
  hiv: 'hiv/aids',
  aids: 'hiv/aids',
  'hiv aids': 'hiv/aids',

  // Malaria
  'plasmodium': 'malaria',

  // Cholera
  'vibrio cholerae': 'cholera',

  // Measles
  rubeola: 'measles',

  // Hepatitis
  'hep b': 'hepatitis b',
  'hep c': 'hepatitis c',
  'hep a': 'hepatitis a',
  hepatitis: 'hepatitis b', // default to B when unspecified

  // Dengue
  'dengue fever': 'dengue',
  'break-bone fever': 'dengue',

  // Diabetes
  diabetes: 'diabetes mellitus',
  'type 2 diabetes': 'diabetes mellitus',
  'type 1 diabetes': 'diabetes mellitus',

  // Respiratory
  pneumonia: 'lower respiratory infections',
  'respiratory infections': 'lower respiratory infections',
  lri: 'lower respiratory infections',

  // RSV
  rsv: 'respiratory syncytial virus',

  // Typhoid
  'typhoid fever': 'typhoid',
  'enteric fever': 'typhoid',

  // Ebola
  'ebola virus': 'ebola',
  evd: 'ebola',

  // Zika
  'zika virus': 'zika',

  // West Nile
  'west nile virus': 'west nile',
  wnv: 'west nile',

  // Legionnaires
  'legionnaires disease': 'legionella',
  legionnaires: 'legionella',

  // Diarrheal
  diarrhea: 'diarrheal diseases',
  diarrhoea: 'diarrheal diseases',

  // Cardiovascular
  'heart disease': 'cardiovascular diseases',
  cvd: 'cardiovascular diseases',

  // Cancer
  'neoplasms': 'cancer',
  tumor: 'cancer',
  tumour: 'cancer',

  // Neonatal
  'neonatal disorders': 'neonatal',

  // Salmonella
  salmonellosis: 'salmonella',

  // Rabies — no alias needed

  // Yellow fever — no alias needed

  // Monkeypox / mpox
  monkeypox: 'mpox',
};

// ---------------------------------------------------------------------------
// Region -> ISO 3166-1 alpha-3 code mapping
// Includes common country names, abbreviations, and demonyms
// ---------------------------------------------------------------------------
const REGION_TO_ISO3 = {
  // Global / no region
  global: null,
  world: null,
  worldwide: null,

  // Major countries
  india: 'IND',
  'republic of india': 'IND',
  bharat: 'IND',

  china: 'CHN',
  'people\'s republic of china': 'CHN',
  prc: 'CHN',

  'united states': 'USA',
  'united states of america': 'USA',
  us: 'USA',
  usa: 'USA',
  america: 'USA',

  'united kingdom': 'GBR',
  uk: 'GBR',
  'great britain': 'GBR',
  britain: 'GBR',
  england: 'GBR',

  brazil: 'BRA',
  russia: 'RUS',
  'russian federation': 'RUS',

  germany: 'DEU',
  france: 'FRA',
  italy: 'ITA',
  spain: 'ESP',
  portugal: 'PRT',
  netherlands: 'NLD',
  holland: 'NLD',
  belgium: 'BEL',
  switzerland: 'CHE',
  austria: 'AUT',
  sweden: 'SWE',
  norway: 'NOR',
  denmark: 'DNK',
  finland: 'FIN',
  poland: 'POL',
  ireland: 'IRL',
  greece: 'GRC',
  'czech republic': 'CZE',
  czechia: 'CZE',
  romania: 'ROU',
  hungary: 'HUN',
  croatia: 'HRV',
  bulgaria: 'BGR',

  japan: 'JPN',
  'south korea': 'KOR',
  korea: 'KOR',
  australia: 'AUS',
  'new zealand': 'NZL',
  indonesia: 'IDN',
  thailand: 'THA',
  vietnam: 'VNM',
  'viet nam': 'VNM',
  malaysia: 'MYS',
  philippines: 'PHL',
  singapore: 'SGP',
  pakistan: 'PAK',
  bangladesh: 'BGD',
  'sri lanka': 'LKA',
  nepal: 'NPL',
  myanmar: 'MMR',
  burma: 'MMR',
  cambodia: 'KHM',

  canada: 'CAN',
  mexico: 'MEX',
  argentina: 'ARG',
  colombia: 'COL',
  peru: 'PER',
  chile: 'CHL',
  venezuela: 'VEN',
  ecuador: 'ECU',

  nigeria: 'NGA',
  'south africa': 'ZAF',
  egypt: 'EGY',
  kenya: 'KEN',
  ethiopia: 'ETH',
  ghana: 'GHA',
  tanzania: 'TZA',
  uganda: 'UGA',
  morocco: 'MAR',
  algeria: 'DZA',
  sudan: 'SDN',
  'south sudan': 'SSD',
  'democratic republic of the congo': 'COD',
  drc: 'COD',
  congo: 'COG',
  cameroon: 'CMR',
  'ivory coast': 'CIV',
  'cote d\'ivoire': 'CIV',
  senegal: 'SEN',
  mali: 'MLI',
  mozambique: 'MOZ',
  madagascar: 'MDG',
  zimbabwe: 'ZWE',
  zambia: 'ZMB',
  angola: 'AGO',
  rwanda: 'RWA',
  somalia: 'SOM',

  'saudi arabia': 'SAU',
  iran: 'IRN',
  iraq: 'IRQ',
  turkey: 'TUR',
  turkiye: 'TUR',
  israel: 'ISR',
  'united arab emirates': 'ARE',
  uae: 'ARE',
  qatar: 'QAT',
  kuwait: 'KWT',
  jordan: 'JOR',
  lebanon: 'LBN',
  afghanistan: 'AFG',
  yemen: 'YEM',
  syria: 'SYR',

  // Already ISO-3 codes — pass through
  ind: 'IND',
  chn: 'CHN',
  gbr: 'GBR',
  deu: 'DEU',
  fra: 'FRA',
  ita: 'ITA',
  esp: 'ESP',
  bra: 'BRA',
  rus: 'RUS',
  jpn: 'JPN',
  kor: 'KOR',
  aus: 'AUS',
  can: 'CAN',
  mex: 'MEX',
  nga: 'NGA',
  zaf: 'ZAF',
  egy: 'EGY',
  ken: 'KEN',
  eth: 'ETH',
  sau: 'SAU',
  irn: 'IRN',
  irq: 'IRQ',
  tur: 'TUR',
  isr: 'ISR',
  are: 'ARE',
  tha: 'THA',
  vnm: 'VNM',
  idn: 'IDN',
  mys: 'MYS',
  phl: 'PHL',
  sgp: 'SGP',
  pak: 'PAK',
  bgd: 'BGD',
  lka: 'LKA',
  npl: 'NPL',
  arg: 'ARG',
  col: 'COL',
  per: 'PER',
  chl: 'CHL',
  ven: 'VEN',
  nld: 'NLD',
  bel: 'BEL',
  che: 'CHE',
  aut: 'AUT',
  swe: 'SWE',
  nor: 'NOR',
  dnk: 'DNK',
  fin: 'FIN',
  pol: 'POL',
  irl: 'IRL',
  grc: 'GRC',
  cze: 'CZE',
  rou: 'ROU',
  hun: 'HUN',
  hrv: 'HRV',
  bgr: 'BGR',
  prt: 'PRT',
  nzl: 'NZL',
  mmr: 'MMR',
  khm: 'KHM',
  ecu: 'ECU',
  gha: 'GHA',
  tza: 'TZA',
  uga: 'UGA',
  mar: 'MAR',
  dza: 'DZA',
  sdn: 'SDN',
  ssd: 'SSD',
  cod: 'COD',
  cog: 'COG',
  cmr: 'CMR',
  civ: 'CIV',
  sen: 'SEN',
  mli: 'MLI',
  moz: 'MOZ',
  mdg: 'MDG',
  zwe: 'ZWE',
  zmb: 'ZMB',
  ago: 'AGO',
  rwa: 'RWA',
  som: 'SOM',
  qat: 'QAT',
  kwt: 'KWT',
  jor: 'JOR',
  lbn: 'LBN',
  afg: 'AFG',
  yem: 'YEM',
  syr: 'SYR',
};

// Reverse lookup: ISO3 -> common country name (for display)
const ISO3_TO_NAME = {};
for (const [name, code] of Object.entries(REGION_TO_ISO3)) {
  if (code && !ISO3_TO_NAME[code]) {
    // Use the first (shortest) mapping as display name
    ISO3_TO_NAME[code] = name;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize a disease name: lowercase, trim, resolve aliases.
 * Returns the canonical disease name.
 *
 * @param {string} rawDisease - User-supplied disease string
 * @returns {string} Canonical disease name
 */
function normalizeDisease(rawDisease) {
  if (!rawDisease) return '';
  const cleaned = rawDisease.toLowerCase().trim().replace(/\s+/g, ' ');
  return DISEASE_ALIASES[cleaned] || cleaned;
}

/**
 * Normalize a region string: lowercase, trim, resolve to ISO-3 code.
 * Returns an object with both the ISO-3 code and a display name.
 *
 * If the region cannot be mapped, the original string is returned as-is
 * (connectors may still attempt a best-effort match).
 *
 * @param {string} rawRegion - User-supplied region string
 * @returns {{ iso3: string|null, name: string }} Normalized region info
 */
function normalizeRegion(rawRegion) {
  if (!rawRegion) return { iso3: null, name: 'global' };
  const cleaned = rawRegion.toLowerCase().trim().replace(/\s+/g, ' ');

  if (cleaned === 'global' || cleaned === 'world' || cleaned === 'worldwide') {
    return { iso3: null, name: 'global' };
  }

  const iso3 = REGION_TO_ISO3[cleaned];
  if (iso3) {
    return { iso3, name: ISO3_TO_NAME[iso3] || cleaned };
  }

  // Check if the input is already a 3-letter uppercase ISO code
  const upper = cleaned.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper) && REGION_TO_ISO3[cleaned]) {
    return { iso3: REGION_TO_ISO3[cleaned], name: ISO3_TO_NAME[REGION_TO_ISO3[cleaned]] || cleaned };
  }

  // Could not resolve — return the raw string so connectors can try
  return { iso3: null, name: cleaned };
}

/**
 * Get all known aliases for a given canonical disease name.
 * Useful for broader searches across connectors.
 *
 * @param {string} canonicalDisease - Canonical disease name
 * @returns {string[]} Array of aliases (including the canonical name itself)
 */
function getDiseaseAliases(canonicalDisease) {
  if (!canonicalDisease) return [];
  const canonical = canonicalDisease.toLowerCase().trim();
  const aliases = [canonical];

  for (const [alias, target] of Object.entries(DISEASE_ALIASES)) {
    if (target === canonical && alias !== canonical) {
      aliases.push(alias);
    }
  }

  return aliases;
}

module.exports = {
  normalizeDisease,
  normalizeRegion,
  getDiseaseAliases,
  DISEASE_ALIASES,
  REGION_TO_ISO3,
  ISO3_TO_NAME,
};
