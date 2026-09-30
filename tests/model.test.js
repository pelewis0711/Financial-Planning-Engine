import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, applyWhatIf, defaultWhatIf } from '../src/engine/model.js';
import { ALL_FIELDS, blankInputs } from '../src/ui/schema.js';
import { SAMPLE_CLIENT } from '../src/ui/sample-client.js';
import { esc } from '../src/engine/format.js';
import { sample, simpleSingle } from './helpers.js';

const titles = (M) => M.R.map((r) => r.title);

test('schema: every sample-client key is a real intake field', () => {
  const ids = new Set(ALL_FIELDS.map((f) => f.id));
  for (const k of Object.keys(SAMPLE_CLIENT)) assert.ok(ids.has(k), `unknown field ${k}`);
});

test('schema: blank inputs cover every field with a typed default', () => {
  const d = blankInputs();
  for (const f of ALL_FIELDS) assert.ok(f.id in d, `missing ${f.id}`);
  assert.equal(d.filing, 'Single');
  assert.deepEqual(d.children, []);
  assert.equal(d.as_mc_trials, 1000);
});

test('model is reproducible: same inputs and seed → identical plan', () => {
  assert.deepEqual(buildModel(sample()), buildModel(sample()));
});

test('different seeds give slightly different Monte Carlo results', () => {
  const a = buildModel(sample(), { seed: 1 }).ret.successRate;
  const b = buildModel(sample(), { seed: 2 }).ret.successRate;
  assert.ok(Math.abs(a - b) < 0.05, 'sampling noise should be small at 1,000 trials');
});

test('rules are ranked by score, highest first', () => {
  const { R } = buildModel(sample());
  for (let i = 1; i < R.length; i++) assert.ok(R[i - 1].score >= R[i].score);
  assert.ok(R.every((r) => ['high', 'med', 'low'].includes(r.priority)));
});

test('sample client triggers the expected headline findings', () => {
  const t = titles(buildModel(sample()));
  for (const expected of [
    'Establish an owner-side qualified plan',      // $120k SE income, no plan
    'Illinois estate tax exposure — no portability',
    'Retire credit cards — rate exceeds hurdle',    // 22.9% APR
    'Concentrated position exceeds prudence threshold',
    'No buy-sell agreement',
    'Core estate documents missing',
  ]) assert.ok(t.includes(expected), `missing: ${expected}`);
});

test('a clean, simple profile does not trigger estate or business rules', () => {
  const M = buildModel(simpleSingle({
    doc_will: 'Yes', doc_poa_fin: 'Yes', doc_poa_hc: 'Yes', doc_directive: 'Yes', doc_trust: 'Yes', benef_current: 'Yes',
  }));
  assert.ok(!M.R.some((r) => r.domain === 'estate'));
  assert.ok(!M.R.some((r) => r.domain === 'business'));
});

test('unclaimed employer match is flagged as high priority', () => {
  const M = buildModel(simpleSingle({ c1_match: 4, c1_match_cap: 6, c1_401k_contrib: 2000 }));
  const rec = M.R.find((r) => r.title === 'Unclaimed employer match');
  assert.ok(rec);
  assert.equal(rec.priority, 'high');
});

test('direct Roth contributions above the MAGI limit are flagged', () => {
  const M = buildModel(simpleSingle({ c1_salary: 250000, c1_roth_contrib: 7500 }));
  assert.ok(titles(M).some((t) => t.startsWith('Direct Roth IRA contributions are impermissible')));
});

test('what-if overrides shift both spouses’ retirement ages together', () => {
  const d = sample();
  const w = { ...defaultWhatIf(d), retage: 65 };
  const out = applyWhatIf(d, w);
  assert.equal(out.c1_retage, 65);
  assert.equal(out.c2_retage, d.c2_retage + 3);
});

test('free-text client input is escaped in rendered recommendations', () => {
  const M = buildModel(simpleSingle({ c1_name: '<img src=x onerror=alert(1)>', c1_match: 4, c1_match_cap: 6, c1_401k_contrib: 0, c1_salary: 100000 }));
  const html = M.R.map((r) => r.title + r.body).join('');
  assert.ok(!html.includes('<img'));
  assert.equal(esc('<b>"&\''), '&lt;b&gt;&quot;&amp;&#39;');
});

test('regression snapshot: Whitmore household headline numbers', () => {
  const M = buildModel(sample());
  const snap = {
    successRate: M.ret.successRate,
    totalTax: Math.round(M.tax.totalTax),
    netWorth: Math.round(M.ins.netWorth),
    atRetirement: Math.round(M.ret.atRetirement),
    firstRMD: Math.round(M.ret.firstRMD),
    recommendations: M.R.length,
  };
  assert.deepEqual(snap, SNAPSHOT);
});

// Update deliberately (and explain why in the commit) when engine logic changes.
const SNAPSHOT = {
  successRate: 0.914,
  totalTax: 190071,
  netWorth: 3340500,
  atRetirement: 8533328,
  firstRMD: 493317,
  recommendations: 35,
};
