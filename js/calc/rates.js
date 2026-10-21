// Custom rates from the Saskatchewan Ministry of Agriculture
// "2026-27 Farm Machinery Custom and Rental Rate Guide"
// https://publications.saskatchewan.ca/#/products/76527
// Custom rates include power unit, fuel ($1.257/L), labour ($28/hr) and a 15% margin.
// Work rates assume 80% field efficiency. Update these numbers when a new guide comes out.
export const GUIDE = { name: 'Sask 2026-27 Custom Rate Guide', fieldEfficiency: 80 };

// [name, size, $/hr, acres/hr, $/acre]  ($/acre is null when the guide lists hourly only)
const T = (name, size, perHr, acPerHr = null, perAc = null) => ({ name, size, perHr, acPerHr, perAc });

export const RATE_GROUPS = [
  { group: 'Seeding', short: 'Seed', items: [
    T('Air drill, independent openers', '25-45 ft', 613.47, 14, 43.82),
    T('Air drill, independent openers', '46-65 ft', 858.12, 23, 37.31),
    T('Air drill, independent openers', '66-86 ft', 1015.12, 30, 33.84),
    T('Air hoe drill', '27-50 ft', 511.73, 16, 31.98),
    T('Air hoe drill', '51-72 ft', 867.79, 24, 36.16),
    T('Air disc drill', '30-49 ft', 731.30, 19, 38.49),
    T('Air disc drill', '50-70 ft', 983.12, 28, 35.11),
    T('Row crop planter', '12 row', 475.69, 13, 36.59),
    T('Row crop planter', '16 row', 750.86, 17, 44.17),
    T('Row crop planter', '24 row', 1028.61, 25, 41.14),
    T('Split row planter', '12/24 row', 799.23, 19, 42.06),
    T('Split row planter', '16/32 row', 980.25, 25, 39.21),
  ] },
  { group: 'Spraying', short: 'Spray', items: [
    T('High clearance sprayer', '800 gal, 90 ft', 684.80, 70, 9.78),
    T('High clearance sprayer', '1000 gal, 100 ft', 752.30, 78, 9.64),
    T('High clearance sprayer', '1200 gal, 120 ft', 868.50, 93, 9.34),
    T('High clearance sprayer', '1600 gal, 130 ft', 984.70, 101, 9.75),
  ] },
  { group: 'Harvesting', short: 'Harvest', items: [
    T('Combine, Class 6', '301-360 hp', 505.89, 10, 50.59),
    T('Combine, Class 7', '361-420 hp', 599.04, 12, 49.92),
    T('Combine, Class 8', '421-500 hp', 684.79, 15, 45.65),
    T('Combine, Class 9', '501-560 hp', 729.48, 17, 42.91),
    T('Combine, Class 10', '561+ hp', 898.10, 21, 42.77),
    T('Swather, draper', '25 ft', 205.98, 13, 15.84),
    T('Swather, draper', '30 ft', 233.35, 16, 14.58),
    T('Swather, draper', '35 ft', 252.04, 19, 13.27),
    T('Swather, draper', '40 ft', 264.94, 21, 12.62),
    T('Grain cart + 4WD', '500-1000 bu', 347.90),
    T('Grain cart + 4WD', '1050-1600 bu', 426.69),
    T('Grain cart + 4WD', '2000 bu', 496.81),
  ] },
  { group: 'Tillage & land rolling', short: 'Tillage', items: [
    T('Field cultivator', '24-35 ft', 301.04, 15, 20.07),
    T('Field cultivator', '36-49 ft', 370.19, 21, 17.63),
    T('Field cultivator', '50-62 ft', 422.44, 27, 15.65),
    T('Heavy duty cultivator', '23-40 ft', 364.16, 15, 24.28),
    T('Heavy duty cultivator', '41-50 ft', 422.44, 22, 19.20),
    T('Heavy duty cultivator', '51-62 ft', 468.06, 27, 17.34),
    T('Harrows, mid', '60-90 ft', 429.70, 51, 8.43),
    T('Harrows, heavy', '60-90 ft', 498.20, 51, 9.77),
    T('Harrow packers', '25-62 ft', 211.36, 32, 6.61),
    T('High-speed disk', '10-30 ft', 445.79, 16, 27.86),
    T('High-speed disk', '31-50 ft', 618.04, 31, 19.94),
    T('Heavy duty high-speed disk', '10-25 ft', 514.53, 14, 36.75),
    T('Heavy duty high-speed disk', '26-40 ft', 665.08, 26, 25.58),
    T('Land roller', '20 ft', 187.94, 9, 20.88),
    T('Land roller', '40-50 ft', 339.00, 26, 13.04),
    T('Land roller', '55-75 ft', 433.70, 38, 11.41),
  ] },
  { group: 'Hay', short: 'Hay', items: [
    T('SP disc mower conditioner', '13-19 ft', 327.59, 12, 27.30),
    T('SP disc mower conditioner', '30 ft', 654.58, 23, 28.46),
    T('SP sickle mower conditioner', '14-18 ft', 313.95, 9, 34.88),
    T('Wheel rake', '16-20 ft', 145.96, 10, 14.60),
    T('Wheel rake', '21-30 ft', 180.04, 13, 13.85),
    T('Wheel rake', '31-40 ft', 222.64, 20, 11.13),
  ] },
];

// Stable id from name + size so a remembered choice survives guide updates.
RATE_GROUPS.forEach((g) => g.items.forEach((r) => { r.id = `${r.name} ${r.size}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }));
export const rateById = (id) => RATE_GROUPS.flatMap((g) => g.items).find((r) => r.id === id);
