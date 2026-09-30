/** Risk management: life (capital-needs), disability, liability and LTC exposure. */

const FINAL_EXPENSES = 25000;
const LIFE_INCOME_REPLACEMENT = 0.75;
const DI_TARGET_REPLACEMENT = 0.60;

export function computeInsurance(d, tax, a, cf) {
  // Present value of a growing income stream (annuity due).
  const pvIncome = (income, yrs) => {
    if (yrs <= 0 || income <= 0) return 0;
    const g = a.wage, r = a.disc;
    return income * (1 - Math.pow((1 + g) / (1 + r), yrs)) / (r - g) * (1 + r);
  };

  const kids = d.children || [];
  const eduNeed = kids.reduce((s, c) => {
    const yrsTo = Math.max(0, 18 - c.age);
    const cost = a.as_college_cost * a.as_college_years * Math.pow(1 + a.collInfl, yrsTo) * ((c.college || 0) / 100);
    return s + Math.max(0, cost - (c.plan529 || 0));
  }, 0);
  const debts = d.mtg_balance + d.heloc + d.auto_loans + d.student_loans + d.cc_debt + d.other_debt;
  const liquid = d.cash_checking + d.cash_savings + d.brokerage;

  const lifeNeeds = (income, yrsToRet, existing) => {
    const need = pvIncome(income * LIFE_INCOME_REPLACEMENT, yrsToRet) + debts + eduNeed + FINAL_EXPENSES - liquid;
    return { need: Math.max(0, need), existing, gap: Math.max(0, Math.max(0, need) - existing) };
  };
  const c1Income = d.c1_salary + d.c1_bonus + d.se_income;
  const c2Income = d.c2_salary + d.c2_bonus;
  const life1 = lifeNeeds(c1Income, Math.max(1, d.c1_retage - d.c1_age), d.c1_life_term + d.c1_life_perm + d.c1_life_group);
  const life2 = c2Income > 0
    ? lifeNeeds(c2Income, Math.max(1, (d.c2_retage || 65) - (d.c2_age || 40)), d.c2_life_term + d.c2_life_perm + d.c2_life_group)
    : null;

  const disability = (income, ltdPct, def) => {
    const target = income * DI_TARGET_REPLACEMENT, covered = income * (ltdPct / 100);
    return { target, covered, gap: Math.max(0, target - covered), def };
  };
  const di1 = disability(c1Income, d.c1_ltd, d.c1_ltd_def);
  const di2 = c2Income > 0 ? disability(c2Income, d.c2_ltd, d.c2_ltd_def) : null;

  const netWorth = liquid + d.c1_401k + d.c2_401k + d.c1_trad_ira + d.c2_trad_ira + d.c1_roth_ira + d.c2_roth_ira + d.hsa_balance
    + d.home_value + d.other_re + d.business_value + d.other_assets + kids.reduce((s, c) => s + (c.plan529 || 0), 0) - debts;
  const umbrellaTarget = netWorth > 500000 ? Math.ceil(netWorth / 1000000) * 1000000 : (netWorth > 250000 ? 1000000 : 0);
  const umbrellaGap = Math.max(0, umbrellaTarget - d.umbrella);

  const ltcFlag1 = d.c1_age >= 50 && d.ltc_c1 !== 'Yes';
  const ltcFlag2 = d.c2_age >= 50 && d.ltc_c2 !== 'Yes';

  return { life1, life2, di1, di2, eduNeed, debts, liquid, netWorth, umbrellaTarget, umbrellaGap, ltcFlag1, ltcFlag2 };
}
