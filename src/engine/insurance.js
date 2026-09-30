/** Risk management: life (needs analysis), disability, liability and LTC exposure. */
import { T26 } from './params/ty2026.js';
import { computeTax } from './tax.js';

const FINAL_EXPENSES = 25000;
const HLV_INCOME_REPLACEMENT = 0.75;
const DI_TARGET_REPLACEMENT = 0.60;

/** The two adults, normalized so the needs analysis can treat either as the decedent. */
function adults(d) {
  const c1 = {
    key: 'c1', name: d.c1_name, age: d.c1_age, retage: d.c1_retage || 65,
    salary: d.c1_salary, bonus: d.c1_bonus, se: d.se_income, // self-employment income belongs to client 1
    deferral: d.c1_401k_contrib, deferralType: d.c1_401k_type, rothIra: d.c1_roth_contrib,
    pia: d.c1_ss_fra, lifeInForce: d.c1_life_term + d.c1_life_perm + d.c1_life_group,
  };
  const hasSpouse = !!(d.c2_name || d.c2_age > 0);
  const c2 = hasSpouse ? {
    key: 'c2', name: d.c2_name, age: d.c2_age, retage: d.c2_retage || 65,
    salary: d.c2_salary, bonus: d.c2_bonus, se: 0,
    deferral: d.c2_401k_contrib, deferralType: d.c2_401k_type, rothIra: d.c2_roth_contrib,
    pia: d.c2_ss_fra, lifeInForce: d.c2_life_term + d.c2_life_perm + d.c2_life_group,
  } : null;
  return { c1, c2 };
}

/**
 * The survivor's take-home pay after tax and their own retirement saving.
 * Taxes are computed with the full tax engine on a survivor-only profile:
 * head of household with dependents (single without), decedent's wages gone,
 * mortgage paid off, portfolio income excluded (the portfolio is counted as
 * available capital instead).
 */
export function survivorTakeHome(d, s) {
  const gross = s.salary + s.bonus + s.se;
  if (gross <= 0) return { gross: 0, net: 0 };
  const hasKids = (d.children || []).some((c) => c.age < 18);
  const profile = {
    ...d,
    filing: hasKids ? 'Head of Household' : 'Single',
    c1_age: s.age, c1_salary: s.salary, c1_bonus: s.bonus, se_income: s.se,
    c1_401k_contrib: s.deferral, c1_401k_type: s.deferralType,
    c2_age: 0, c2_salary: 0, c2_bonus: 0, c2_401k_contrib: 0,
    interest_income: 0, div_qualified: 0, div_ordinary: 0, cap_gains_lt: 0, cap_gains_st: 0,
    pension_income: 0, mtg_balance: 0, hsa_contrib: 0,
  };
  const tax = computeTax(profile);
  return { gross, net: gross - tax.totalTax - s.deferral - s.rothIra, tax: tax.totalTax };
}

/**
 * Social Security survivor benefits in year `t` after the death: 75% of the
 * decedent's PIA per child under 18, plus 75% to the surviving parent while a
 * child is under 16 (subject to the earnings test), capped at the family max.
 */
export function survivorBenefits(pia, kids, t, survivorEarnings) {
  const p = T26.ssSurvivor;
  if (!pia) return 0;
  const minors = kids.filter((c) => c.age + t < p.childUntilAge).length;
  const childBen = minors * p.childPct * pia;
  let parentBen = 0;
  if (survivorEarnings !== null && kids.some((c) => c.age + t < p.parentUntilChildAge)) {
    const withheld = Math.max(0, survivorEarnings - p.earningsTestExempt) * p.earningsTestRate;
    parentBen = Math.max(0, p.parentPct * pia - withheld);
  }
  return Math.min(childBen + parentBen, p.familyMaxPct * pia);
}

/**
 * Life insurance need if `decedent` dies today (capital-needs method).
 *
 * Works in today's dollars and discounts at the real discount rate:
 *   survivor spending = household spending − debt service (debts are paid off
 *                       from the death benefit) − decedent's personal share;
 *                       childcare drops off once the youngest turns 18
 *   annual gap        = survivor spending − survivor take-home − SS benefits
 *   need              = PV(annual gaps) + debts + unfunded education
 *                       + final expenses − liquid assets
 * The horizon runs until the survivor retires or the youngest child turns 18,
 * whichever is later. Retirement accounts are assumed to fund the survivor's
 * own retirement, so they are neither counted as available capital nor is a
 * separate retirement need added.
 */
function lifeNeed(d, a, cf, ctx, decedent, survivor) {
  const kids = d.children || [];
  const debtService = (cf.ds.mtg + cf.nonMtgDebtM) * 12;
  const baseSpend = Math.max(0, cf.expAnnual - debtService);
  const spendWithKids = baseSpend * (1 - a.consumption);
  const spendAfterKids = Math.max(0, baseSpend - d.exp_child * 12) * (1 - a.consumption);

  const yrsKids = Math.max(0, ...kids.map((c) => 18 - c.age));
  const yrsWork = survivor ? Math.max(0, survivor.retage - survivor.age) : 0;
  const horizon = Math.max(yrsKids, yrsWork);

  const take = survivor ? survivorTakeHome(d, survivor) : { gross: 0, net: 0 };
  const rReal = (1 + a.disc) / (1 + a.infl) - 1;
  const gReal = (1 + a.wage) / (1 + a.infl) - 1;

  let pvGap = 0;
  const years = [];
  for (let t = 0; t < horizon; t++) {
    const working = t < yrsWork;
    const growth = Math.pow(1 + gReal, t);
    const spend = kids.some((c) => c.age + t < 18) ? spendWithKids : spendAfterKids;
    const income = working ? take.net * growth : 0;
    const ss = survivorBenefits(decedent.pia, kids, t, survivor ? (working ? take.gross * growth : 0) : null);
    const gap = Math.max(0, spend - income - ss);
    pvGap += gap / Math.pow(1 + rReal, t); // annuity due: first year is immediate
    years.push({ t, spend, income, ss, gap });
  }

  const lumpSums = ctx.debts + ctx.eduNeed + FINAL_EXPENSES;
  const need = Math.max(0, pvGap + lumpSums - ctx.liquid);
  const existing = decedent.lifeInForce;

  // Income-replacement (human-life-value) figure, shown as a ceiling.
  const income = decedent.salary + decedent.bonus + decedent.se;
  const yrsToRet = Math.max(1, decedent.retage - decedent.age);
  const g = a.wage, r = a.disc;
  const hlv = income > 0
    ? income * HLV_INCOME_REPLACEMENT * (1 - Math.pow((1 + g) / (1 + r), yrsToRet)) / (r - g) * (1 + r)
    : 0;

  return {
    need, existing, gap: Math.max(0, need - existing),
    hlv, horizon, pvGap, lumpSums,
    survivorSpend: spendWithKids, survivorNet: take.net, ssYear1: years[0]?.ss || 0,
    years,
  };
}

export function computeInsurance(d, tax, a, cf) {
  const kids = d.children || [];
  const eduNeed = kids.reduce((s, c) => {
    const yrsTo = Math.max(0, 18 - c.age);
    const cost = a.as_college_cost * a.as_college_years * Math.pow(1 + a.collInfl, yrsTo) * ((c.college || 0) / 100);
    return s + Math.max(0, cost - (c.plan529 || 0));
  }, 0);
  const debts = d.mtg_balance + d.heloc + d.auto_loans + d.student_loans + d.cc_debt + d.other_debt;
  const liquid = d.cash_checking + d.cash_savings + d.brokerage;
  const ctx = { debts, eduNeed, liquid };

  const { c1, c2 } = adults(d);
  const life1 = lifeNeed(d, a, cf, ctx, c1, c2);
  const life2 = c2 ? lifeNeed(d, a, cf, ctx, c2, c1) : null;

  const c1Income = c1.salary + c1.bonus + c1.se;
  const c2Income = c2 ? c2.salary + c2.bonus : 0;
  const disability = (income, ltdPct, def) => {
    const target = income * DI_TARGET_REPLACEMENT, covered = income * (ltdPct / 100);
    return { target, covered, gap: Math.max(0, target - covered), def };
  };
  const di1 = disability(c1Income, d.c1_ltd, d.c1_ltd_def);
  const di2 = c2Income > 0 ? disability(c2Income, d.c2_ltd, d.c2_ltd_def) : null;

  const netWorth = liquid + d.c1_401k + d.c2_401k + d.c1_trad_ira + d.c2_trad_ira + d.c1_roth_ira + d.c2_roth_ira + d.hsa_balance
    + d.home_value + d.other_re + d.business_value + d.other_assets + kids.reduce((s, c) => s + (c.plan529 || 0), 0) - debts;
  // Liability limits should cover what a judgment creditor could actually reach.
  // Employer plans (ERISA), IRAs/Roth IRAs (federal bankruptcy exemption; fully
  // exempt in Illinois) and 529 plans (exempt in Illinois) are excluded.
  const protectedAssets = d.c1_401k + d.c2_401k + d.c1_trad_ira + d.c2_trad_ira + d.c1_roth_ira + d.c2_roth_ira
    + kids.reduce((s, c) => s + (c.plan529 || 0), 0);
  const exposedNetWorth = Math.max(0, netWorth - protectedAssets);
  const umbrellaTarget = exposedNetWorth > 500000 ? Math.ceil(exposedNetWorth / 1000000) * 1000000 : (exposedNetWorth > 250000 ? 1000000 : 0);
  const umbrellaGap = Math.max(0, umbrellaTarget - d.umbrella);

  const ltcFlag1 = d.c1_age >= 50 && d.ltc_c1 !== 'Yes';
  const ltcFlag2 = d.c2_age >= 50 && d.ltc_c2 !== 'Yes';

  return { life1, life2, di1, di2, eduNeed, debts, liquid, netWorth, exposedNetWorth, umbrellaTarget, umbrellaGap, ltcFlag1, ltcFlag2 };
}
