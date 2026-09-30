/**
 * Tax Year 2026 parameters (post-OBBBA).
 *
 * Every dollar figure the engine depends on lives in this one file so the
 * rules can be audited against their sources and rolled forward each year
 * without touching calculation code.
 *
 * Sources:
 *   - IRS Rev. Proc. 2025-32 (brackets, standard deduction, LTCG, AMT, estate)
 *   - IRS Notice 2025-67 (qualified-plan and IRA limits)
 *   - IRS Rev. Proc. 2025-19 (HSA limits)
 *   - SSA 2026 COLA fact sheet (Social Security wage base)
 *   - CMS 2026 Medicare Parts A & B premiums fact sheet (IRMAA)
 *   - One Big Beautiful Bill Act, P.L. 119-21 (SALT cap, senior deduction, CTC)
 *
 * Brackets are expressed as [lowerBound, rate] pairs: income above lowerBound
 * (and below the next pair's lowerBound) is taxed at rate.
 */

export const TAX_YEAR = 2026;

export const FILING_STATUSES = [
  'Single',
  'Married Filing Jointly',
  'Head of Household',
  'Married Filing Separately',
];

export const T26 = {
  brackets: {
    'Single':                    [[0, .10], [12400, .12], [50400, .22], [105700, .24], [201775, .32], [256225, .35], [640600, .37]],
    'Married Filing Jointly':    [[0, .10], [24800, .12], [100800, .22], [211400, .24], [403550, .32], [512450, .35], [768700, .37]],
    'Head of Household':         [[0, .10], [17700, .12], [67450, .22], [105700, .24], [201775, .32], [256200, .35], [640600, .37]],
    'Married Filing Separately': [[0, .10], [12400, .12], [50400, .22], [105700, .24], [201775, .32], [256225, .35], [384350, .37]],
  },
  stdDed: { 'Single': 16100, 'Married Filing Jointly': 32200, 'Head of Household': 24150, 'Married Filing Separately': 16100 },
  // Additional standard deduction per qualifying person age 65+.
  addlStdDed65: { 'Single': 2050, 'Married Filing Jointly': 1650, 'Head of Household': 2050, 'Married Filing Separately': 1650 },
  // OBBBA senior deduction, tax years 2025–2028.
  seniorDeduction: {
    amount: 6000,
    phaseStart: { 'Single': 75000, 'Married Filing Jointly': 150000, 'Head of Household': 75000, 'Married Filing Separately': 75000 },
    phaseRate: .06,
  },
  ltcg: {
    'Single':                    [[0, 0], [49450, .15], [545500, .20]],
    'Married Filing Jointly':    [[0, 0], [98900, .15], [613700, .20]],
    'Head of Household':         [[0, 0], [66200, .15], [579600, .20]],
    'Married Filing Separately': [[0, 0], [49450, .15], [306850, .20]],
  },
  niit: { rate: .038, thresh: { 'Single': 200000, 'Married Filing Jointly': 250000, 'Head of Household': 200000, 'Married Filing Separately': 125000 } },
  addlMedicare: { rate: .009, thresh: { 'Single': 200000, 'Married Filing Jointly': 250000, 'Head of Household': 200000, 'Married Filing Separately': 125000 } },
  amt: {
    exempt: { 'Single': 90100, 'Married Filing Jointly': 140200, 'Head of Household': 90100, 'Married Filing Separately': 70100 },
    phaseStart: { 'Single': 500000, 'Married Filing Jointly': 1000000, 'Head of Household': 500000, 'Married Filing Separately': 500000 },
    rate1: .26, rate2: .28, breakpoint: 244500,
  },
  salt: { cap: 40400, magiPhaseStart: 505000, floor: 10000, phaseRate: .30 },
  qbi: {
    rate: .20,
    thresh: { 'Single': 201775, 'Married Filing Jointly': 403500, 'Head of Household': 201775, 'Married Filing Separately': 201775 },
    range: { 'Single': 75000, 'Married Filing Jointly': 150000, 'Head of Household': 75000, 'Married Filing Separately': 75000 },
    minDed: 400, minQBI: 1000,
  },
  ctc: {
    amount: 2200, refundable: 1700,
    phaseStart: { 'Single': 200000, 'Married Filing Jointly': 400000, 'Head of Household': 200000, 'Married Filing Separately': 200000 },
    phaseRate: .05,
  },
  fica: { ssWageBase: 184500, ssRate: .062, medRate: .0145, seFactor: .9235 },
  retirement: {
    d401k: 24500, catch50: 8000, superCatch: 11250, superAgeLo: 60, superAgeHi: 63,
    dcTotal: 72000, rothCatchupWage: 150000,
    ira: 7500, iraCatch: 1100,
    rothPhase: { 'Single': [153000, 168000], 'Married Filing Jointly': [242000, 252000], 'Head of Household': [153000, 168000], 'Married Filing Separately': [0, 10000] },
    tradPhaseActive: { 'Single': [81000, 91000], 'Married Filing Jointly': [129000, 149000], 'Head of Household': [81000, 91000], 'Married Filing Separately': [0, 10000] },
    tradPhaseSpouse: [242000, 252000],
    hsaSelf: 4400, hsaFam: 8750, hsaCatch: 1000,
    simple: 17000, sep_pct: .25, sep_max: 72000,
    // SECURE 2.0 §107: born 1951–1959 → 73; born 1960+ → 75.
    rmdAge: (birthYear) => birthYear >= 1960 ? 75 : 73,
    qcdAge: 70.5, qcdMax: 115000, r529ToRoth: 35000,
  },
  estate: { fedExemption: 15000000, annualGift: 19000, ilExemption: 4000000, ilPortability: false, superfund529: 95000 },
  il: { rate: .0495, retirementExempt: true },
  // Medicare Part B IRMAA. Monthly premium per person; cliff thresholds on MAGI
  // from two years prior. [threshold, premium]: MAGI above threshold → premium.
  irmaa: {
    stdB: 202.90,
    tiers: {
      'Single':                 [[109000, 284.10], [137000, 405.80], [171000, 527.50], [205000, 649.30], [500000, 689.90]],
      'Married Filing Jointly': [[218000, 284.10], [274000, 405.80], [342000, 527.50], [410000, 649.30], [750000, 689.90]],
    },
  },
  educ: { aotc: 2500, aotcPhase: { 'Single': [80000, 90000], 'Married Filing Jointly': [160000, 180000] } },
  ssTax: { t1: { 'Single': 25000, 'Married Filing Jointly': 32000 }, t2: { 'Single': 34000, 'Married Filing Jointly': 44000 } },
};
