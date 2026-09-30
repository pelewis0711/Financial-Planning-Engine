/**
 * Model assembly: runs every domain engine over a set of client inputs and
 * returns a single immutable-by-convention model object that the rules
 * engine and the report renderer both read from.
 *
 * Pure: no DOM access. The same function powers the browser UI and the
 * Node test suite.
 */
import { resolveAssumptions } from './assumptions.js';
import { computeTax } from './tax.js';
import { computeCashFlow } from './cashflow.js';
import { computeRetirement } from './retirement.js';
import { computeInsurance } from './insurance.js';
import { computeEstate } from './estate.js';
import { computeEducation } from './education.js';
import { computeDebt } from './debt.js';
import { computeInvestments } from './investments.js';
import { computeRothLadder } from './roth-ladder.js';
import { runRules } from './rules.js';
import { mulberry32, DEFAULT_SEED } from './random.js';

/** The what-if lab's starting position: the client's own intake values. */
export function defaultWhatIf(d) {
  return { retage: d.c1_retage || 65, extra: 0, spend: 0, eq: d.alloc_equity || 70 };
}

/** Apply what-if lab overrides (retirement age, extra savings, spending, allocation). */
export function applyWhatIf(d, w) {
  if (!w) return d;
  const c = { ...d };
  const shift = w.retage - d.c1_retage;
  c.c1_retage = w.retage;
  if (d.c2_retage) c.c2_retage = d.c2_retage + shift;
  c._extraSave = w.extra;
  if (w.spend > 0) c.ret_spend = w.spend;
  c.alloc_equity = w.eq;
  return c;
}

/**
 * @param {object} inputs  Client intake + assumptions (see ui/schema.js).
 * @param {object} [opts]
 * @param {object} [opts.whatIf]  Overrides from the what-if lab.
 * @param {number} [opts.seed]    Monte Carlo seed (default: DEFAULT_SEED).
 * @param {function} [opts.rng]   Custom uniform RNG; takes precedence over seed.
 */
export function buildModel(inputs, { whatIf = defaultWhatIf(inputs), seed = DEFAULT_SEED, rng } = {}) {
  const d = applyWhatIf(inputs, whatIf);
  const a = resolveAssumptions(d);
  const tax = computeTax(d);
  const cf = computeCashFlow(d, tax);
  const ret = computeRetirement(d, tax, a, cf, rng || mulberry32(seed));
  const ins = computeInsurance(d, tax, a, cf);
  const est = computeEstate(d, ins, ret, a);
  const edu = computeEducation(d, a);
  const debt = computeDebt(d, tax, a);
  const inv = computeInvestments(d);
  const ladder = computeRothLadder(d, tax, ret, a);
  const M = { d, dRaw: inputs, tax, cf, ret, ins, est, edu, debt, inv, a, ladder };
  M.R = runRules(M);
  return M;
}
