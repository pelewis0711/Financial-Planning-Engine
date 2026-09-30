/** Capital-market and planning assumptions. */

export const DEFAULT_ASSUMPTIONS = {
  as_inflation: 2.5, as_salary_growth: 3, as_equity_ret: 8.5, as_equity_vol: 16,
  as_bond_ret: 4.3, as_bond_vol: 5.5, as_cash_ret: 2.8, as_college_infl: 5,
  as_college_cost: 28000, as_college_years: 4, as_life_exp: 95, as_mc_trials: 1000,
  as_ret_equity: 50, as_discount: 4.5, as_personal_consumption: 25,
};

/** Equity/fixed-income correlation used for the blended portfolio σ. */
export const EQUITY_BOND_CORRELATION = 0.15;

/**
 * Resolve assumptions from inputs: any blank/zero field falls back to the
 * default, and percentage fields are also exposed as decimals.
 */
export function resolveAssumptions(d) {
  const a = {};
  for (const k of Object.keys(DEFAULT_ASSUMPTIONS)) a[k] = d[k] > 0 ? d[k] : DEFAULT_ASSUMPTIONS[k];
  a.infl = a.as_inflation / 100;
  a.wage = a.as_salary_growth / 100;
  a.eqRet = a.as_equity_ret / 100;
  a.eqVol = a.as_equity_vol / 100;
  a.bdRet = a.as_bond_ret / 100;
  a.bdVol = a.as_bond_vol / 100;
  a.cashRet = a.as_cash_ret / 100;
  a.collInfl = a.as_college_infl / 100;
  a.disc = a.as_discount / 100;
  a.consumption = a.as_personal_consumption / 100;
  return a;
}

/** Expected return and volatility of a two-asset equity / fixed-income mix. */
export function blendedReturn(eqPct, a) {
  const e = eqPct / 100, b = 1 - e;
  return {
    mu: e * a.eqRet + b * a.bdRet,
    sigma: Math.sqrt((e * a.eqVol) ** 2 + (b * a.bdVol) ** 2 + 2 * EQUITY_BOND_CORRELATION * e * a.eqVol * b * a.bdVol),
  };
}
