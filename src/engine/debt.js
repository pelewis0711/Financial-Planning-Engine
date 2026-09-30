/** Debt prioritization: avalanche order against an after-tax investment hurdle. */

export function computeDebt(d, tax, a) {
  const items = [
    { name: 'Credit Cards', bal: d.cc_debt, rate: d.cc_rate },
    { name: 'Other Debt', bal: d.other_debt, rate: d.other_debt_rate },
    { name: 'HELOC', bal: d.heloc, rate: d.heloc_rate },
    { name: 'Auto Loans', bal: d.auto_loans, rate: d.auto_rate },
    { name: 'Student Loans', bal: d.student_loans, rate: d.student_rate },
    { name: 'Mortgage', bal: d.mtg_balance, rate: d.mtg_rate },
  ].filter((x) => x.bal > 0).sort((x, y) => y.rate - x.rate);
  const total = items.reduce((s, x) => s + x.bal, 0);
  // After-tax equity return: the hurdle a debt rate must beat to be paid down first.
  const hurdle = (1 - tax.marginalFed - tax.stateIncTaxRate) * 8.5;
  return { items, total, hurdle };
}
