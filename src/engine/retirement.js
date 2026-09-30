/**
 * Retirement capital sufficiency: deterministic projection, Monte Carlo
 * simulation, Social Security, RMDs and contribution-capacity analysis.
 */
import { T26, TAX_YEAR } from './params/ty2026.js';
import { blendedReturn } from './assumptions.js';
import { gaussian } from './random.js';
import { firstRmdDivisor } from './roth-ladder.js';

/**
 * Social Security benefit at claiming age, relative to the full-retirement-age
 * (FRA = 67) benefit.
 *   Early: −5/9 of 1% per month for the first 36 months (6⅔%/yr),
 *          −5/12 of 1% per month beyond that (5%/yr) → 70% of PIA at 62.
 *   Late:  +8%/yr delayed retirement credits, capped at age 70.
 */
export function ssAdjust(fraBenefit, claimAge) {
  if (!fraBenefit) return 0;
  const c = claimAge || 67;
  if (c >= 67) return fraBenefit * (1 + .08 * Math.min(3, c - 67));
  const monthsEarly = Math.round((67 - c) * 12);
  const reduction = Math.min(monthsEarly, 36) * (5 / 9 / 100) + Math.max(0, monthsEarly - 36) * (5 / 12 / 100);
  return fraBenefit * (1 - reduction);
}

/**
 * Monte Carlo simulation of accumulation followed by decumulation.
 *
 * Annual returns are lognormal with arithmetic mean `mu` and volatility
 * `sigma`. During accumulation, contributions grow with wages; during
 * decumulation, `withdrawal(year)` is removed each year. A trial fails the
 * first year its balance is exhausted.
 *
 * @returns {{successRate:number, endings:number[], paths:number[][]}}
 *   `endings` sorted ascending; `paths` holds the first `keepPaths` trials.
 */
export function runMonteCarlo({
  startBalance, annualContrib, wageGrowth, yrsToRet, yrsInRet,
  accumulation, decumulation, withdrawal, trials, keepPaths = 120,
}, rng) {
  const totalYears = yrsToRet + yrsInRet;
  const endings = [];
  const paths = [];
  let success = 0;

  for (let t = 0; t < trials; t++) {
    let b = startBalance;
    const p = [b];
    let failed = false;
    for (let y = 1; y <= totalYears; y++) {
      const inRet = y > yrsToRet;
      const { mu, sigma } = inRet ? decumulation : accumulation;
      const r = Math.exp((Math.log(1 + mu) - sigma * sigma / 2) + sigma * gaussian(rng)) - 1;
      if (!inRet) {
        b = b * (1 + r) + annualContrib * Math.pow(1 + wageGrowth, y);
      } else {
        b = b * (1 + r) - Math.max(0, withdrawal(y));
        if (b <= 0) { failed = true; b = 0; p.push(0); break; }
      }
      p.push(b);
    }
    if (!failed) success++;
    endings.push(b);
    if (t < keepPaths) paths.push(p);
  }
  endings.sort((x, y) => x - y);
  return { successRate: success / trials, endings, paths };
}

/** Value at quantile `q` of an ascending-sorted array. */
export const quantile = (sorted, q) => sorted[Math.floor(q * sorted.length)] || 0;

export function computeRetirement(d, tax, a, cf, rng) {
  const yrsToRet = Math.max(1, d.c1_retage - d.c1_age);
  const retAge = d.c1_retage || 65;
  const lifeExp = a.as_life_exp;
  const yrsInRet = Math.max(1, lifeExp - retAge);
  const eq = d.alloc_equity > 0 ? d.alloc_equity : 70;
  const { mu, sigma } = blendedReturn(eq, a);
  const retPhase = blendedReturn(a.as_ret_equity, a);

  // Current retirement capital and annual additions
  const balances = d.c1_401k + d.c2_401k + d.c1_trad_ira + d.c2_trad_ira + d.c1_roth_ira + d.c2_roth_ira + d.hsa_balance + d.brokerage;
  const employer = d.c1_salary * (d.c1_match / 100) + d.c2_salary * (d.c2_match / 100);
  const annualContrib = d.c1_401k_contrib + d.c2_401k_contrib + d.c1_roth_contrib + d.c2_roth_contrib + d.hsa_contrib + employer + (d._extraSave || 0);

  // Deterministic projection at the expected return
  let bal = balances;
  const path = [bal];
  for (let y = 1; y <= yrsToRet; y++) {
    bal = bal * (1 + mu) + annualContrib * Math.pow(1 + a.wage, y);
    path.push(bal);
  }
  const atRetirement = bal;

  // Spending need (default: 80% of current core expenses excluding childcare)
  const coreSpend = d.ret_spend > 0 ? d.ret_spend : (cf.expAnnual - d.exp_child * 12) * 0.80;
  const spendAtRet = coreSpend * Math.pow(1 + a.infl, yrsToRet);

  // Guaranteed income
  const ss1 = ssAdjust(d.c1_ss_fra, d.c1_ss_claim), ss2 = ssAdjust(d.c2_ss_fra, d.c2_ss_claim);
  const claim1 = d.c1_ss_claim || 67, claim2 = d.c2_ss_claim || 67;
  const pensions = d.c1_pension_ret + d.c2_pension_ret;
  const c2AgeAtRet = d.c2_age ? retAge - (d.c1_age - d.c2_age) : retAge;
  const guaranteedYr1 = ((retAge >= claim1 ? ss1 : 0) + (c2AgeAtRet >= claim2 ? ss2 : 0)) * Math.pow(1 + a.infl, yrsToRet) + pensions;
  const guaranteedFull = (ss1 + ss2) * Math.pow(1 + a.infl, yrsToRet) + pensions;
  const bridgeYears = Math.max(0, claim1 - retAge);
  const netNeed = Math.max(0, spendAtRet - guaranteedYr1);
  const wdRate = atRetirement > 0 ? netNeed / atRetirement : 1;

  // Monte Carlo
  const trials = Math.min(5000, Math.max(200, a.as_mc_trials));
  const withdrawal = (y) => {
    const age1 = d.c1_age + y, age2 = (d.c2_age || d.c1_age) + y;
    const ssNow = (age1 >= claim1 ? ss1 : 0) + (d.c2_ss_fra > 0 && age2 >= claim2 ? ss2 : 0);
    return coreSpend * Math.pow(1 + a.infl, y) - ssNow * Math.pow(1 + a.infl, y) - pensions;
  };
  const mc = runMonteCarlo({
    startBalance: balances, annualContrib, wageGrowth: a.wage, yrsToRet, yrsInRet,
    accumulation: { mu, sigma }, decumulation: retPhase, withdrawal, trials,
  }, rng);

  // Required minimum distributions
  const by1 = TAX_YEAR - d.c1_age, by2 = TAX_YEAR - d.c2_age;
  const rmdAge1 = T26.retirement.rmdAge(by1), rmdAge2 = T26.retirement.rmdAge(by2);
  const pretaxBal = d.c1_401k + d.c2_401k + d.c1_trad_ira + d.c2_trad_ira;
  const yrsToRMD = Math.max(0, rmdAge1 - d.c1_age);
  const pretaxAtRMD = pretaxBal * Math.pow(1 + mu, yrsToRMD)
    + (tax.pretaxDeferrals + employer) * ((Math.pow(1 + mu, Math.min(yrsToRMD, yrsToRet)) - 1) / mu);
  const firstRMD = pretaxAtRMD / firstRmdDivisor(rmdAge1);

  // Contribution capacity
  const r = T26.retirement;
  const deferralCap = (age) => r.d401k + (age >= r.superAgeLo && age <= r.superAgeHi ? r.superCatch : age >= 50 ? r.catch50 : 0);
  const cap1 = deferralCap(d.c1_age), cap2 = deferralCap(d.c2_age);
  const iraCap1 = r.ira + (d.c1_age >= 50 ? r.iraCatch : 0), iraCap2 = r.ira + (d.c2_age >= 50 ? r.iraCatch : 0);
  const rp = r.rothPhase[tax.fs] || r.rothPhase['Single'];
  const rothBlocked = tax.magi > rp[1], rothPartial = tax.magi > rp[0] && tax.magi <= rp[1];
  const proRataExposure = (d.c1_trad_ira - d.c1_ira_basis) + (d.c2_trad_ira - d.c2_ira_basis);
  const rothCatchupMandate1 = d.c1_age >= 50 && (d.c1_salary + d.c1_bonus) > r.rothCatchupWage;
  const rothCatchupMandate2 = d.c2_age >= 50 && (d.c2_salary + d.c2_bonus) > r.rothCatchupWage;

  const q = (p) => quantile(mc.endings, p);
  return {
    yrsToRet, retAge, lifeExp, yrsInRet, mu, sigma, balances, annualContrib, employer, atRetirement, path,
    coreSpend, spendAtRet, ss1, ss2, guaranteed: guaranteedYr1, guaranteedFull, bridgeYears, netNeed, wdRate,
    successRate: mc.successRate,
    p10: q(.10), p25: q(.25), median: q(.50), p75: q(.75), p90: q(.90),
    allPaths: mc.paths, totalYears: yrsToRet + yrsInRet,
    rmdAge1, rmdAge2, pretaxBal, pretaxAtRMD, firstRMD,
    cap1, cap2, iraCap1, iraCap2, rothBlocked, rothPartial, rothPhase: rp, proRataExposure,
    rothCatchupMandate1, rothCatchupMandate2,
    unused1: Math.max(0, cap1 - d.c1_401k_contrib), unused2: Math.max(0, cap2 - d.c2_401k_contrib),
  };
}
