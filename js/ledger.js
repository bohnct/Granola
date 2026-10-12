// Inventory + sales math shared by the Inventory and Sales tabs.
import * as sheets from './sheets.js';
import * as data from './data.js';
import { commodity } from './config.js';
import * as U from './units.js';

export const cropYearId = (year, com) => `${year}-${com}`;
export const currentCropYear = () => new Date().getFullYear(); // harvest year

// Fill the derived columns the Sheet stores for readability.
export function withDerived(sale) {
  const qty = Number(sale.qty) || 0;
  const price = Number(sale.price) || 0;
  const bushels = U.toBu(qty, sale.qtyUnit || 'bu', sale.commodity);
  const tonnes = U.buToMt(bushels, sale.commodity);
  const pricePerBu = U.pricePerBu(price, sale.priceUnit || '$/bu', sale.commodity);
  const pricePerMt = U.pricePerMt(price, sale.priceUnit || '$/bu', sale.commodity);
  return {
    ...sale,
    cropYearId: cropYearId(sale.year, sale.commodity),
    bushels: round(bushels, 2), tonnes: round(tonnes, 3),
    pricePerBu: round(pricePerBu, 4), pricePerMt: round(pricePerMt, 2),
    value: round(bushels * pricePerBu, 2),
  };
}
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

export function years() {
  const ys = new Set([currentCropYear()]);
  for (const r of sheets.rows('CropYears')) ys.add(Number(r.year));
  for (const r of sheets.rows('Sales')) ys.add(Number(r.year));
  return [...ys].filter(Boolean).sort((a, b) => b - a);
}

export const cropYear = (year, com) => sheets.rows('CropYears').find((r) => r.id === cropYearId(year, com));
export const targetsFor = (year, com) => sheets.rows('Targets').filter((r) => r.cropYearId === cropYearId(year, com));
export const salesFor = (year, com) => sheets.rows('Sales')
  .filter((r) => Number(r.year) === Number(year) && (!com || r.commodity === com))
  .map(withDerived)
  .sort((a, b) => String(b.date).localeCompare(String(a.date)));

// Best (highest) current LDC cash bid for a commodity, in $/MT.
export function bestBid(com) {
  const key = commodity(com)?.cashBidKey;
  const bids = key ? data.cashBids(key) : [];
  return bids.reduce((best, b) => (!best || b.price > best.price ? b : best), null);
}

export function summary(year, com) {
  const cy = cropYear(year, com);
  const sales = salesFor(year, com);
  const produced = Number(cy?.producedBu) || 0;
  const target = Number(cy?.targetSellBu) || produced; // blank target = sell everything
  const soldBu = sales.reduce((s, r) => s + r.bushels, 0);
  const income = sales.reduce((s, r) => s + r.value, 0);
  const deliveredBu = sales.filter((r) => r.delivered).reduce((s, r) => s + r.bushels, 0);
  const unsoldBu = Math.max(0, produced - soldBu);
  const bid = bestBid(com);
  const avgPerBu = soldBu ? income / soldBu : null;
  return {
    produced, target, soldBu, income, deliveredBu, unsoldBu, bid, avgPerBu,
    avgPerMt: avgPerBu == null ? null : U.perBuToPerMt(avgPerBu, com),
    pctSold: produced ? soldBu / produced : 0,
    pctTarget: target ? soldBu / target : null,
    toTargetBu: Math.max(0, target - soldBu),
    unsoldValue: bid ? U.buToMt(unsoldBu, com) * bid.price : null,
    count: sales.length,
  };
}

// Is a price target met by today's best LDC bid?
export function targetMet(t, com) {
  const bid = bestBid(com);
  if (!bid || t.price == null) return false;
  return bid.price >= U.pricePerMt(Number(t.price), t.priceUnit || '$/MT', com);
}
