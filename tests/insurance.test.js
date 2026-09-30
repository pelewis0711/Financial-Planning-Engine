import { test } from 'node:test';
import assert from 'node:assert/strict';
import { survivorBenefits, survivorTakeHome } from '../src/engine/insurance.js';
import { buildModel } from '../src/engine/model.js';
import { sample, simpleSingle } from './helpers.js';

const need = (overrides) => buildModel(sample(overrides)).ins.life1.need;

test('needs analysis sits well below the income-replacement ceiling for the sample household', () => {
  const { life1 } = buildModel(sample()).ins;
  assert.ok(life1.need < life1.hlv / 3, `need ${life1.need} vs ceiling ${life1.hlv}`);
  assert.ok(life1.need > 0);
});

test('the surviving spouse’s income reduces the need', () => {
  assert.ok(need({ c2_salary: 60000 }) > need({ c2_salary: 145000 }));
});

test('a larger personal-consumption share reduces the need', () => {
  assert.ok(need({ as_personal_consumption: 35 }) < need({ as_personal_consumption: 15 }));
});

test('Social Security survivor benefits reduce the need', () => {
  assert.ok(need({ c1_ss_fra: 0 }) > need({ c1_ss_fra: 44000 }));
});

test('more debt raises the lump-sum need dollar for dollar', () => {
  const extra = 100000;
  const base = buildModel(sample()).ins.life1;
  const more = buildModel(sample({ auto_loans: 42000 + extra })).ins.life1;
  // The added debt's service leaves survivor spending too, so the ongoing gap can shift slightly.
  assert.equal(more.lumpSums - base.lumpSums, extra);
  assert.ok(more.need > base.need);
});

test('single filer with no dependents: no income need, only debts + final expenses − liquid assets', () => {
  const { life1, liquid, debts } = buildModel(simpleSingle({ cash_savings: 10000, cc_debt: 5000 })).ins;
  assert.equal(life1.horizon, 0);
  assert.equal(life1.pvGap, 0);
  assert.equal(life1.need, Math.max(0, debts + 25000 - liquid));
});

test('survivor benefits: 75% of PIA per minor child, capped at the family maximum', () => {
  const kids = [{ age: 10 }, { age: 12 }, { age: 14 }];
  assert.equal(survivorBenefits(40000, [{ age: 10 }], 0, null), 30000);
  assert.equal(survivorBenefits(40000, kids, 0, null), 1.75 * 40000); // 3 × 30k capped at 70k
  assert.equal(survivorBenefits(40000, [{ age: 17 }], 1, null), 0);   // child turns 18
});

test('survivor benefits: parent benefit is subject to the earnings test', () => {
  const kid = [{ age: 5 }];
  const lowEarner = survivorBenefits(20000, kid, 0, 0);          // no earnings: 15k child + 15k parent
  const highEarner = survivorBenefits(20000, kid, 0, 150000);    // parent benefit fully withheld
  assert.equal(lowEarner, 30000);
  assert.equal(highEarner, 15000);
  assert.equal(survivorBenefits(20000, kid, 0, 24480 + 10000), 15000 + 15000 - 5000);
});

test('survivor take-home is gross pay less taxes and the survivor’s own retirement saving', () => {
  const d = sample();
  const t = survivorTakeHome(d, { salary: 100000, bonus: 0, se: 0, age: 45, deferral: 10000, deferralType: 'Traditional (pre-tax)', rothIra: 0 });
  assert.equal(t.gross, 100000);
  assert.ok(t.net > 60000 && t.net < 80000, `net ${t.net}`);
});

test('a spouse with no earnings still gets a needs analysis', () => {
  const { life2 } = buildModel(sample({ c2_salary: 0, c2_bonus: 0 })).ins;
  assert.ok(life2, 'life2 computed for a non-earning spouse');
  assert.equal(life2.hlv, 0);
});

test('coverage well above need is flagged, not sold more', () => {
  const titles = buildModel(sample()).R.map((r) => r.title);
  assert.ok(titles.some((t) => t.startsWith('Life coverage exceeds needs-based estimate')));
  assert.ok(!titles.some((t) => t.startsWith('Life insurance gap')));
});

test('an underinsured single-income family with young kids still shows a gap', () => {
  const M = buildModel(sample({
    c2_salary: 0, c2_bonus: 0, c2_401k_contrib: 0, c2_roth_contrib: 0,
    children: [{ name: 'A', age: 2, college: 100, plan529: 0, contrib529: 0, special: 'No' }],
    brokerage: 50000, cash_savings: 20000, c1_life_term: 250000, c1_life_group: 0,
  }));
  assert.ok(M.ins.life1.gap > 100000, `gap ${M.ins.life1.gap}`);
  assert.ok(M.R.some((r) => r.title.startsWith('Life insurance gap')));
});

test('umbrella target covers creditor-exposed assets, not protected retirement and 529 balances', () => {
  const { ins } = buildModel(sample());
  assert.ok(ins.exposedNetWorth < ins.netWorth);
  assert.equal(ins.umbrellaTarget, Math.ceil(ins.exposedNetWorth / 1e6) * 1e6);
  const moreIn401k = buildModel(sample({ c1_401k: 820000 + 2_000_000 })).ins;
  assert.equal(moreIn401k.umbrellaTarget, ins.umbrellaTarget, '401(k) growth does not raise the umbrella target');
});
