// ★ Expansion point. Add facilities and commodities here.

// Must match the "key" values in scripts/fetch_ldc.py FACILITIES.
export const FACILITIES = [
  { key: 'yorkton', name: 'LDC Yorkton' },
];
export const DEFAULT_FACILITY = 'yorkton';

// buPerMt: bushels per metric tonne (standard Canadian bushel weights).
// inventory: true -> shows up in Inventory & Sales.
// cashBidKey / futuresKey: names used by LDC's feed (see data/latest.json).
export const COMMODITIES = [
  { id: 'canola',   name: 'Canola',   buPerMt: 44.092, inventory: true, cashBidKey: 'canola', futuresKey: 'canola' },
  { id: 'nexera',   name: 'Nexera',   buPerMt: 44.092, inventory: false, cashBidKey: 'nexera', futuresKey: 'canola' },
  { id: 'wheat',    name: 'Wheat',    buPerMt: 36.744, inventory: true },
  { id: 'durum',    name: 'Durum',    buPerMt: 36.744 },
  { id: 'barley',   name: 'Barley',   buPerMt: 45.930 },
  { id: 'oats',     name: 'Oats',     buPerMt: 64.842 },
  { id: 'peas',     name: 'Peas',     buPerMt: 36.744 },
  { id: 'lentils',  name: 'Lentils',  buPerMt: 36.744 },
  { id: 'flax',     name: 'Flax',     buPerMt: 39.368 },
  { id: 'soybeans', name: 'Soybeans', buPerMt: 36.744, futuresKey: 'soybeans' },
  { id: 'corn',     name: 'Corn',     buPerMt: 39.368, futuresKey: 'corn' },
];

// Futures shown on the Futures tab, in order. LDC quotes canola in $/MT CAD.
// LDC's feed also has soybeans and corn (CBOT, US ¢/bu); add them back here to show them.
export const FUTURES = [
  { key: 'canola',   name: 'Canola',   unit: 'CAD/MT', exchange: 'ICE' },
];

export const commodity = (id) => COMMODITIES.find((c) => c.id === id);
export const inventoryCommodities = () => COMMODITIES.filter((c) => c.inventory);
