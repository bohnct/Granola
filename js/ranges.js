// Time ranges shared by the charts.
export const RANGES = [
  { value: '1M', label: '1M', days: 31 }, { value: '3M', label: '3M', days: 92 },
  { value: '6M', label: '6M', days: 183 }, { value: '1Y', label: '1Y', days: 366 },
  { value: 'All', label: 'All', days: Infinity },
];

// First date (YYYY-MM-DD) inside the range; '' means everything.
export function rangeStart(value) {
  const days = RANGES.find((r) => r.value === value)?.days ?? Infinity;
  return Number.isFinite(days) ? new Date(Date.now() - days * 864e5).toLocaleDateString('en-CA') : '';
}
