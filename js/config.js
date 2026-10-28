// What the app tracks. Edit here to add a facility or commodity.

// Must match the "key" values in scripts/fetch_ldc.py FACILITIES.
export const FACILITY = { key: 'yorkton', name: 'LDC Yorkton' };

// key: the commodity name in LDC's feed (see data/latest.json). Both price off ICE canola futures.
export const COMMODITIES = [
  { key: 'canola', name: 'Canola', short: 'Canola' },
  { key: 'nexera', name: 'Health Canola (Nexera)', short: 'Health (Nexera)' },
];

export const BU_PER_MT = 44.092; // canola bushels per tonne; LDC sends the same factor with each bid

export const commodity = (key) => COMMODITIES.find((c) => c.key === key) ?? COMMODITIES[0];
