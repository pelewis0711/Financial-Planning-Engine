/**
 * Medicare IRMAA and the pre-RMD Roth conversion ladder.
 */
import { T26, TAX_YEAR } from './params/ty2026.js';
import { taxFromBrackets } from './tax.js';
import { blendedReturn } from './assumptions.js';

/**
 * IRMAA tier for a given MAGI. Tier 0 is the standard premium. Thresholds are
 * cliffs: $1 of MAGI over a threshold pays the full higher premium.
 * Head of household and qualifying surviving spouses use the single schedule;
 * married filing separately has its own, much steeper schedule.
 * `index` scales the 2026 thresholds for inflation when testing a future
 * year's MAGI; premiums stay in 2026 dollars.
 */
export function irmaaTier(magi, fs, index = 1) {
  const schedule = fs === 'Married Filing Jointly' || fs === 'Married Filing Separately' ? fs : 'Single';
  const tiers = T26.irmaa.tiers[schedule];
  let tier = 0, prem = T26.irmaa.stdB;
  tiers.forEach(([threshold, premium], i) => {
    const isTop = i === tiers.length - 1;
    const t = threshold * index;
    if (isTop ? magi >= t : magi > t) { tier = i + 1; prem = premium; }
  });
  return { tier, prem, surchargeAnnual: (prem - T26.irmaa.stdB) * 12 };
}

/** Uniform Lifetime Table divisor at the first RMD age. */
export const firstRmdDivisor = (rmdAge) => rmdAge >= 75 ? 24.6 : 26.5;

/** Scale a bracket table's thresholds by an inflation index. */
const indexBrackets = (brackets, f) => brackets.map(([lo, rate]) => [lo * f, rate]);

/**
 * Roth conversion ladder: each year from retirement until RMDs begin, convert
 * enough pre-tax money to fill ordinary income to the top of the 24% bracket.
 * Compares the resulting first RMD and IRMAA tier against doing nothing.
 *
 * Balances are projected in nominal dollars, so brackets, the standard
 * deduction and IRMAA thresholds are indexed forward from 2026 at the
 * inflation assumption to keep every comparison in the same year's dollars.
 */
export function computeRothLadder(d, tax, ret, a) {
  const fs = tax.fs, married = fs === 'Married Filing Jointly';
  const startAge = ret.retAge, endAge = ret.rmdAge1 - 1;
  if (endAge < startAge || ret.pretaxBal <= 0) return null;

  const mu = ret.mu, muRet = blendedReturn(a.as_ret_equity, a).mu;
  // Pre-tax balance at retirement (deferrals and match continue until then)
  const deferrals = tax.pretaxDeferrals + ret.employer;
  const pretaxAtRet = ret.pretaxBal * Math.pow(1 + mu, ret.yrsToRet) + deferrals * ((Math.pow(1 + mu, ret.yrsToRet) - 1) / mu);

  const brackets26 = T26.brackets[fs];
  const top24 = brackets26[brackets26.findIndex((b) => b[1] === .24) + 1][0]; // where 32% begins (2026 $)
  const claim1 = d.c1_ss_claim || 67;
  const indexFor = (year) => Math.pow(1 + a.infl, year - TAX_YEAR);

  const rows = [];
  let balConv = pretaxAtRet, balNo = pretaxAtRet, totConv = 0, totTax = 0;
  const maxRows = Math.min(endAge - startAge + 1, 20);
  for (let i = 0; i < maxRows; i++) {
    const age = startAge + i, yr = TAX_YEAR + ret.yrsToRet + i;
    const f = indexFor(yr);
    const brackets = indexBrackets(brackets26, f);
    const stdDed = T26.stdDed[fs] * f;
    const c2Age = (d.c2_age || d.c1_age) + (age - d.c1_age);
    // Benefits are in today's dollars; COLA-index them to the conversion year.
    const ssNow = ((age >= claim1 ? ret.ss1 : 0) + ((d.c2_ss_fra > 0 && c2Age >= (d.c2_ss_claim || 67)) ? ret.ss2 : 0)) * f;
    const baseOrd = Math.max(0, (d.c1_pension_ret + d.c2_pension_ret) + ssNow * .85 - stdDed);
    const conv = Math.max(0, Math.min(top24 * f - baseOrd, balConv));
    const taxCost = taxFromBrackets(baseOrd + conv, brackets) - taxFromBrackets(baseOrd, brackets);
    const irm = irmaaTier(baseOrd + stdDed + conv, fs, f);
    rows.push({ yr, age, bal: balConv, conv, taxCost, effRate: conv > 0 ? taxCost / conv : 0, irmTier: irm.tier, bracketIndex: f });
    totConv += conv; totTax += taxCost;
    balConv = (balConv - conv) * (1 + muRet);
    balNo = balNo * (1 + muRet);
  }

  const factor = firstRmdDivisor(ret.rmdAge1);
  const rmdWith = balConv / factor, rmdWithout = balNo / factor;
  const rmdIndex = indexFor(TAX_YEAR + (ret.rmdAge1 - d.c1_age));
  const otherIncome = (ret.ss1 + ret.ss2) * rmdIndex * .85 + (d.c1_pension_ret + d.c2_pension_ret);
  const irmWith = irmaaTier(rmdWith + otherIncome, fs, rmdIndex), irmWithout = irmaaTier(rmdWithout + otherIncome, fs, rmdIndex);
  const persons = married ? 2 : 1;
  return {
    rows, pretaxAtRet, totConv, totTax, balConv, balNo, rmdWith, rmdWithout, factor,
    irmWith, irmWithout, persons, top24,
    irmSavings: (irmWithout.surchargeAnnual - irmWith.surchargeAnnual) * persons,
  };
}
