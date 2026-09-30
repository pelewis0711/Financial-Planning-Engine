/** Cash flow, budgeting ratios and debt service. */

/** Level monthly payment to amortize `bal` at `ratePct` over `months`. */
export function amortize(bal, ratePct, months) {
  if (bal <= 0) return 0;
  const r = ratePct / 100 / 12;
  return r > 0 ? bal * r / (1 - Math.pow(1 + r, -months)) : bal / months;
}

/**
 * Monthly debt service derived from the Liabilities section so users never
 * enter it twice. Stated mortgage P&I wins; otherwise it is amortized.
 */
export function computeDebtService(d) {
  return {
    mtg: d.mtg_payment > 0 ? d.mtg_payment : amortize(d.mtg_balance, d.mtg_rate, (d.mtg_years || 25) * 12),
    heloc: d.heloc * (d.heloc_rate / 100) / 12,       // interest-only
    auto: amortize(d.auto_loans, d.auto_rate, 60),
    student: amortize(d.student_loans, d.student_rate, 120),
    cc: d.cc_debt * .03,                               // 3% revolving minimum
    other: amortize(d.other_debt, d.other_debt_rate, 60),
  };
}

export function computeCashFlow(d, tax) {
  const ds = computeDebtService(d);
  const nonMtgDebtM = ds.heloc + ds.auto + ds.student + ds.cc + ds.other;
  const expM = d.exp_housing + ds.mtg + d.exp_transport + d.exp_food + d.exp_insurance + d.exp_health
    + d.exp_child + nonMtgDebtM + d.exp_disc + d.exp_other;
  const expAnnual = expM * 12 + d.charitable_annual;
  const savings = d.c1_401k_contrib + d.c2_401k_contrib + d.c1_roth_contrib + d.c2_roth_contrib + d.hsa_contrib
    + (d.children || []).reduce((s, c) => s + (c.contrib529 || 0), 0);

  // Surplus = gross income − all taxes − living expenses − all savings flows.
  const surplus = tax.grossIncome - tax.totalTax - expAnnual - savings;
  const savingsRate = tax.grossIncome > 0 ? savings / tax.grossIncome : 0;
  const efMonths = expM > 0 ? d.cash_savings / expM : 99;
  const essentialM = expM - d.exp_disc;
  const housingRatio = tax.grossIncome > 0 ? ((d.exp_housing + ds.mtg) * 12) / tax.grossIncome : 0;
  const dtiFront = housingRatio;
  const dtiBack = tax.grossIncome > 0 ? ((d.exp_housing + ds.mtg + nonMtgDebtM) * 12) / tax.grossIncome : 0;

  return { expM, expAnnual, savings, surplus, savingsRate, efMonths, essentialM, housingRatio, dtiFront, dtiBack, ds, nonMtgDebtM };
}
