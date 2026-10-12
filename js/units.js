// Shared conversion math. Every quantity is normalised through bushels/tonnes here.
import { COMMODITIES, commodity } from './config.js';

export const KG_PER_LB = 0.45359237;
const overrides = {}; // user-edited bu/MT factors, loaded from settings

export function setOverrides(map = {}) {
  for (const k of Object.keys(overrides)) delete overrides[k];
  Object.assign(overrides, map);
}

export function buPerMt(id) {
  const v = overrides[id] ?? commodity(id)?.buPerMt;
  if (!v) throw new Error(`Unknown commodity ${id}`);
  return v;
}

export const defaultBuPerMt = (id) => commodity(id)?.buPerMt;
export const lbPerBu = (id) => 1000 / KG_PER_LB / buPerMt(id);

// Quantities ---------------------------------------------------------------
export const buToMt = (bu, id) => bu / buPerMt(id);
export const mtToBu = (mt, id) => mt * buPerMt(id);

export function toBu(qty, unit, id) {
  switch (unit) {
    case 'bu': return qty;
    case 'MT': return mtToBu(qty, id);
    case 'kg': return mtToBu(qty / 1000, id);
    case 'lb': return mtToBu((qty * KG_PER_LB) / 1000, id);
    default: throw new Error(`Unknown unit ${unit}`);
  }
}
export const toMt = (qty, unit, id) => buToMt(toBu(qty, unit, id), id);

// Prices -------------------------------------------------------------------
export const perMtToPerBu = (p, id) => p / buPerMt(id);
export const perBuToPerMt = (p, id) => p * buPerMt(id);
export const pricePerMt = (price, unit, id) => (unit === '$/bu' ? perBuToPerMt(price, id) : price);
export const pricePerBu = (price, unit, id) => (unit === '$/MT' ? perMtToPerBu(price, id) : price);

export { COMMODITIES };
