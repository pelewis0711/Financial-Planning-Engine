/**
 * Federal + state income tax projection (TY2026).
 *
 * Projection fidelity, not preparation fidelity: the goal is a defensible
 * estimate of liability, marginal rates and bracket headroom for planning
 * decisions, not a filed return.
 */
import { T26 } from './params/ty2026.js';
import { fmt$, fmtPct } from './format.js';

/** Progressive tax on `ti` under `brackets` ([lowerBound, rate] pairs). */
export function taxFromBrackets(ti, brackets) {
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const [lo, rate] = brackets[i];
    const hi = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity;
    if (ti > lo) tax += (Math.min(ti, hi) - lo) * rate;
    else break;
  }
  return tax;
}

/** Marginal rate applying to the last dollar of `ti`. */
export function marginalRate(ti, brackets) {
  let r = brackets[0][1];
  for (const [lo, rate] of brackets) if (ti > lo) r = rate;
  return r;
}

/**
 * Tax on preferential income (LTCG + qualified dividends), which stacks on
 * top of ordinary taxable income.
 */
export function ltcgTax(ordTI, prefAmt, fs) {
  const br = T26.ltcg[fs];
  const base = Math.max(0, ordTI);
  let tax = 0;
  for (let i = 0; i < br.length; i++) {
    const [lo, rate] = br[i];
    const hi = i + 1 < br.length ? br[i + 1][0] : Infinity;
    const lower = Math.max(lo, base), upper = Math.min(hi, base + prefAmt);
    if (upper > lower) tax += (upper - lower) * rate;
  }
  return tax;
}

/** Remaining ordinary taxable income before crossing out of the 24% bracket. */
export function roomTo24(ordTI, fs) {
  for (const [lo, rate] of T26.brackets[fs]) if (rate > .24) return Math.max(0, lo - ordTI);
  return 0;
}

export function computeTax(d) {
  const fs = d.filing || 'Single';
  const married = fs === 'Married Filing Jointly';
  const r = T26.retirement;

  // Wages and pre-tax deferrals
  const c1Wages = d.c1_salary + d.c1_bonus, c2Wages = d.c2_salary + d.c2_bonus;
  const wages = c1Wages + c2Wages;
  const pretaxShare = (type, amt) => type === 'Roth' ? 0 : type === 'Split' ? amt / 2 : amt;
  const pretaxDeferrals = pretaxShare(d.c1_401k_type, d.c1_401k_contrib) + pretaxShare(d.c2_401k_type, d.c2_401k_contrib);
  const hsaLimit = (d.hsa_coverage === 'Family' ? r.hsaFam : d.hsa_coverage === 'Self-Only' ? r.hsaSelf : 0) + (d.c1_age >= 55 ? r.hsaCatch : 0);
  const hsaDed = Math.min(d.hsa_contrib, hsaLimit);

  // Self-employment tax (SS portion shares the wage base with client 1's W-2 wages)
  const seBase = d.se_income * T26.fica.seFactor;
  const seSS = Math.min(Math.max(seBase, 0), Math.max(0, T26.fica.ssWageBase - c1Wages)) * T26.fica.ssRate * 2;
  const seMed = Math.max(seBase, 0) * T26.fica.medRate * 2;
  const seTax = d.se_income > 0 ? seSS + seMed : 0;
  const seDed = seTax / 2;

  // Investment income
  const stcg = d.cap_gains_st, ltcg = d.cap_gains_lt, qdiv = d.div_qualified;
  const ordInvest = d.interest_income + d.div_ordinary + stcg;
  const netInvestIncome = ordInvest + ltcg + qdiv + Math.max(0, d.rental_income);

  // AGI
  const totalIncome = wages - pretaxDeferrals + d.se_income + d.rental_income + ordInvest + ltcg + qdiv + d.pension_income + d.other_income;
  const agi = totalIncome - hsaDed - seDed;
  const magi = agi; // approximation for phase-out purposes

  // Itemized vs. standard
  const propTax = Math.min(d.exp_housing * 12 * 0.18, 30000); // rough property-tax share of housing budget
  const stateIncTax = d.state === 'IL' ? Math.max(0, agi - d.pension_income) * T26.il.rate
    : d.state === 'Other (income-taxed state)' ? agi * (d.other_state_rate / 100) : 0;
  let saltAllowed = Math.min(stateIncTax + propTax, T26.salt.cap);
  if (magi > T26.salt.magiPhaseStart) {
    saltAllowed = Math.max(T26.salt.floor, T26.salt.cap - (magi - T26.salt.magiPhaseStart) * T26.salt.phaseRate);
  }
  saltAllowed = Math.min(saltAllowed, stateIncTax + propTax);
  const mortInt = d.mtg_balance > 0 ? Math.min(d.mtg_balance, 750000) * (d.mtg_rate / 100) * 0.97 : 0;
  const itemized = saltAllowed + mortInt + d.charitable_annual;

  let stdDed = T26.stdDed[fs];
  const n65 = (d.c1_age >= 65 ? 1 : 0) + ((married && d.c2_age >= 65) ? 1 : 0);
  stdDed += n65 * T26.addlStdDed65[fs];
  const usingItemized = itemized > stdDed;
  const deduction = Math.max(itemized, stdDed);

  // OBBBA senior deduction (available whether or not itemizing)
  let seniorDed = 0;
  if (n65 > 0) {
    const s = T26.seniorDeduction;
    const excess = Math.max(0, magi - s.phaseStart[fs]);
    seniorDed = Math.max(0, n65 * s.amount - excess * s.phaseRate);
  }

  // §199A qualified business income
  let qbiDed = 0, qbiNote = '';
  if (d.se_income >= T26.qbi.minQBI) {
    const tiPreQBI = Math.max(0, agi - deduction - seniorDed);
    const th = T26.qbi.thresh[fs], rg = T26.qbi.range[fs];
    let allowedPct = 1;
    if (d.se_sstb === 'Yes' && tiPreQBI > th) allowedPct = Math.max(0, 1 - (tiPreQBI - th) / rg);
    qbiDed = Math.max(d.se_income > 0 ? T26.qbi.minDed : 0, T26.qbi.rate * (d.se_income - seDed) * allowedPct);
    qbiDed = Math.min(qbiDed, T26.qbi.rate * tiPreQBI);
    if (allowedPct < 1) qbiNote = `§199A limited — SSTB phase-out ${fmtPct(1 - allowedPct, 0)} complete over the ${fmt$(th)}–${fmt$(th + rg)} band.`;
  }

  const taxableIncome = Math.max(0, agi - deduction - seniorDed - qbiDed);
  const prefIncome = Math.min(taxableIncome, Math.max(0, ltcg) + qdiv);
  const ordTI = taxableIncome - prefIncome;

  const ordTax = taxFromBrackets(ordTI, T26.brackets[fs]);
  const capTax = ltcgTax(ordTI, prefIncome, fs);

  // §1411 net investment income tax
  const niit = Math.max(0, Math.min(netInvestIncome, magi - T26.niit.thresh[fs])) * T26.niit.rate;

  // Additional Medicare tax (0.9%)
  const medWages = wages + Math.max(0, seBase);
  const addlMed = Math.max(0, medWages - T26.addlMedicare.thresh[fs]) * T26.addlMedicare.rate;

  // AMT (simplified: AMTI ≈ TI + SALT add-back)
  const amti = ordTI + prefIncome + (usingItemized ? saltAllowed : 0);
  let amtEx = T26.amt.exempt[fs];
  const amtPh = T26.amt.phaseStart[fs];
  if (amti > amtPh) amtEx = Math.max(0, amtEx - (amti - amtPh) * .5);
  const amtBase = Math.max(0, amti - amtEx - prefIncome);
  const tentAMT = Math.min(amtBase, T26.amt.breakpoint) * T26.amt.rate1
    + Math.max(0, amtBase - T26.amt.breakpoint) * T26.amt.rate2
    + ltcgTax(amtBase, prefIncome, fs);
  const amtOwed = Math.max(0, tentAMT - (ordTax + capTax));

  // Child tax credit
  const kidsUnder17 = (d.children || []).filter((c) => c.age < 17).length;
  const ctcExcess = Math.max(0, magi - T26.ctc.phaseStart[fs]);
  const ctc = Math.max(0, kidsUnder17 * T26.ctc.amount - Math.ceil(ctcExcess / 1000) * 1000 * T26.ctc.phaseRate);

  const fedTax = Math.max(0, ordTax + capTax + amtOwed - ctc) + niit + addlMed + seTax;

  // Employee FICA
  const ficaOn = (w) => Math.min(w, T26.fica.ssWageBase) * T26.fica.ssRate + w * T26.fica.medRate;
  const fica = ficaOn(c1Wages) + ficaOn(c2Wages);

  const totalTax = fedTax + stateIncTax + fica;
  const grossIncome = wages + d.se_income + d.rental_income + ordInvest + ltcg + qdiv + d.pension_income + d.other_income;

  return {
    fs, wages, grossIncome, agi, magi, deduction, stdDed, itemized, usingItemized, saltAllowed, seniorDed,
    qbiDed, qbiNote, taxableIncome, ordTI, prefIncome, ordTax, capTax, niit, addlMed, seTax, amtOwed, ctc,
    fedTax, stateIncTax, fica, totalTax,
    marginalFed: marginalRate(ordTI, T26.brackets[fs]),
    effectiveFed: grossIncome > 0 ? fedTax / grossIncome : 0,
    effectiveTotal: grossIncome > 0 ? totalTax / grossIncome : 0,
    pretaxDeferrals, hsaDed, netInvestIncome,
    stateIncTaxRate: d.state === 'IL' ? T26.il.rate : (d.other_state_rate / 100) || 0,
    room24: roomTo24(ordTI, fs),
    ltcg0room: Math.max(0, T26.ltcg[fs][1][0] - taxableIncome),
  };
}
