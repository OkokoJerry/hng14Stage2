/**
 * Rule-based natural language parser for profile queries.
 * No AI/LLMs. Pure keyword mapping.
 *
 * Supported keywords and their mappings:
 *
 * GENDER:
 *   "male", "males", "men", "man", "boy", "boys"         → gender=male
 *   "female", "females", "women", "woman", "girl", "girls" → gender=female
 *
 * AGE GROUPS:
 *   "child", "children", "kid", "kids"     → age_group=child
 *   "teenager", "teenagers", "teen", "teens", "adolescent" → age_group=teenager
 *   "adult", "adults"                       → age_group=adult
 *   "senior", "seniors", "elderly", "old"  → age_group=senior
 *   "young", "youth"                        → min_age=16 + max_age=24 (not a stored group)
 *
 * AGE RANGES:
 *   "above N" / "over N" / "older than N"  → min_age=N
 *   "below N" / "under N" / "younger than N" → max_age=N
 *   "between N and M"                       → min_age=N + max_age=M
 *   "aged N"                                → min_age=N + max_age=N
 *
 * COUNTRY:
 *   "from <country>" / "in <country>"      → country_id lookup
 *   Also supports ISO codes directly: "from NG"
 */

const COUNTRY_MAP = {
  nigeria: "NG",
  ghana: "GH",
  kenya: "KE",
  tanzania: "TZ",
  uganda: "UG",
  "south africa": "ZA",
  ethiopia: "ET",
  egypt: "EG",
  cameroon: "CM",
  senegal: "SN",
  mali: "ML",
  angola: "AO",
  mozambique: "MZ",
  zambia: "ZM",
  zimbabwe: "ZW",
  rwanda: "RW",
  madagascar: "MG",
  sudan: "SD",
  somalia: "SO",
  "dr congo": "CD",
  congo: "CG",
  "republic of the congo": "CG",
  gabon: "GA",
  eritrea: "ER",
  malawi: "MW",
  "cape verde": "CV",
  mauritius: "MU",
  benin: "BJ",
  "sierra leone": "SL",
  "united states": "US",
  usa: "US",
  america: "US",
  "united kingdom": "GB",
  uk: "GB",
  britain: "GB",
  england: "GB",
  france: "FR",
  germany: "DE",
  india: "IN",
  australia: "AU",
  brazil: "BR",
};

// All ISO codes as uppercase 2-letter strings
const ISO_CODES = new Set(Object.values(COUNTRY_MAP));

function parseNaturalLanguage(query) {
  if (!query || typeof query !== "string" || query.trim() === "") {
    return null;
  }

  const raw = query.trim();
  const q = raw.toLowerCase();
  const filters = {};
  let matched = false;

  // --- GENDER ---
  if (/\b(male|males|man|men|boy|boys)\b/.test(q)) {
    filters.gender = "male";
    matched = true;
  } else if (/\b(female|females|woman|women|girl|girls)\b/.test(q)) {
    filters.gender = "female";
    matched = true;
  }
  // "male and female" → no gender filter (both), still matched
  if (/\b(male and female|female and male|both genders?)\b/.test(q)) {
    delete filters.gender;
    matched = true;
  }

  // --- AGE GROUP ---
  if (/\b(child|children|kid|kids)\b/.test(q)) {
    filters.age_group = "child";
    matched = true;
  } else if (/\b(teenager|teenagers|teen|teens|adolescent|adolescents)\b/.test(q)) {
    filters.age_group = "teenager";
    matched = true;
  } else if (/\b(adult|adults)\b/.test(q)) {
    filters.age_group = "adult";
    matched = true;
  } else if (/\b(senior|seniors|elderly|old people|aged people)\b/.test(q)) {
    filters.age_group = "senior";
    matched = true;
  } else if (/\b(young|youth)\b/.test(q)) {
    // "young" maps to 16-24 for parsing only
    filters.min_age = 16;
    filters.max_age = 24;
    matched = true;
  }

  // --- AGE RANGES (can override age_group age bounds) ---
  // "between N and M"
  const betweenMatch = q.match(/between\s+(\d+)\s+and\s+(\d+)/);
  if (betweenMatch) {
    filters.min_age = parseInt(betweenMatch[1]);
    filters.max_age = parseInt(betweenMatch[2]);
    matched = true;
  }

  // "above N" / "over N" / "older than N"
  const aboveMatch = q.match(/(?:above|over|older than|greater than)\s+(\d+)/);
  if (aboveMatch) {
    filters.min_age = parseInt(aboveMatch[1]);
    matched = true;
  }

  // "below N" / "under N" / "younger than N"
  const belowMatch = q.match(/(?:below|under|younger than|less than)\s+(\d+)/);
  if (belowMatch) {
    filters.max_age = parseInt(belowMatch[1]);
    matched = true;
  }

  // "aged N"
  const agedMatch = q.match(/\baged\s+(\d+)\b/);
  if (agedMatch) {
    filters.min_age = parseInt(agedMatch[1]);
    filters.max_age = parseInt(agedMatch[1]);
    matched = true;
  }

  // --- COUNTRY ---
  // Try multi-word country names first (longest match)
  const sortedCountries = Object.keys(COUNTRY_MAP).sort(
    (a, b) => b.length - a.length
  );

  const countryPreposition = /\b(?:from|in|of|living in|based in)\s+/;
  let countryFound = false;

  for (const countryName of sortedCountries) {
    // with preposition
    const prepositionRegex = new RegExp(
      `(?:from|in|of|living in|based in)\\s+${escapeRegex(countryName)}\\b`
    );
    if (prepositionRegex.test(q)) {
      filters.country_id = COUNTRY_MAP[countryName];
      matched = true;
      countryFound = true;
      break;
    }
  }

  if (!countryFound) {
    // without preposition — try bare country names
    for (const countryName of sortedCountries) {
      const bareRegex = new RegExp(`\\b${escapeRegex(countryName)}\\b`);
      if (bareRegex.test(q)) {
        filters.country_id = COUNTRY_MAP[countryName];
        matched = true;
        countryFound = true;
        break;
      }
    }
  }

  if (!countryFound) {
    // Try ISO code directly e.g. "from NG"
    const isoMatch = raw.match(
      /\b(?:from|in|of)?\s*([A-Z]{2})\b/
    );
    if (isoMatch && ISO_CODES.has(isoMatch[1])) {
      filters.country_id = isoMatch[1];
      matched = true;
    }
  }

  if (!matched || Object.keys(filters).length === 0) {
    return null;
  }

  return filters;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { parseNaturalLanguage };
