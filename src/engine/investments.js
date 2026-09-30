/** Investment policy: target allocation, drift, concentration and behavioral fit. */

export function computeInvestments(d) {
  const rt = d.risk_tol || 5;
  let targetEq = Math.min(90, Math.max(20, 110 - d.c1_age + (rt - 5) * 4));
  if (d.risk_reaction === 'Sell everything') targetEq = Math.min(targetEq, 40);
  if (d.risk_reaction === 'Sell some') targetEq = Math.min(targetEq, 60);
  const currentEq = d.alloc_equity > 0 ? d.alloc_equity : 70;
  const drift = currentEq - targetEq;
  const unrealized = Math.max(0, d.brokerage - d.brokerage_basis);
  const investable = d.brokerage + d.c1_401k + d.c2_401k + d.c1_trad_ira + d.c2_trad_ira + d.c1_roth_ira + d.c2_roth_ira + d.hsa_balance;
  const concFlag = d.concentration > 10;
  const behaviorMismatch = rt >= 7 && (d.risk_reaction === 'Sell everything' || d.risk_reaction === 'Sell some');
  return { targetEq, currentEq, drift, unrealized, investable, concFlag, behaviorMismatch, rt };
}
