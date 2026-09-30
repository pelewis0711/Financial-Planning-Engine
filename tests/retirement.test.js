import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ssAdjust, runMonteCarlo, quantile } from '../src/engine/retirement.js';
import { mulberry32, gaussian } from '../src/engine/random.js';
import { T26 } from '../src/engine/params/ty2026.js';
import { buildModel } from '../src/engine/model.js';
import { sample } from './helpers.js';

const close = (actual, expected, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${expected}, got ${actual}`);

test('Social Security: full benefit at FRA 67', () => {
  assert.equal(ssAdjust(30000, 67), 30000);
});

test('Social Security: 30% reduction at 62, 20% at 64 (SSA schedule)', () => {
  close(ssAdjust(1000, 62), 700);
  close(ssAdjust(1000, 64), 800);
  close(ssAdjust(1000, 66), 1000 * (1 - 12 * 5 / 900));
});

test('Social Security: +8%/yr delayed credits, capped at 70', () => {
  close(ssAdjust(1000, 70), 1240);
  close(ssAdjust(1000, 72), 1240);
});

test('Social Security: no benefit entered means no benefit', () => {
  assert.equal(ssAdjust(0, 62), 0);
});

test('RMD start age follows SECURE 2.0 birth-year rules', () => {
  assert.equal(T26.retirement.rmdAge(1955), 73);
  assert.equal(T26.retirement.rmdAge(1959), 73);
  assert.equal(T26.retirement.rmdAge(1960), 75);
});

test('seeded RNG is deterministic and seed-dependent', () => {
  const a = mulberry32(7), b = mulberry32(7), c = mulberry32(8);
  const seqA = Array.from({ length: 5 }, a), seqB = Array.from({ length: 5 }, b), seqC = Array.from({ length: 5 }, c);
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
  assert.ok(seqA.every((x) => x >= 0 && x < 1));
});

test('gaussian draws have mean ≈ 0 and variance ≈ 1', () => {
  const rng = mulberry32(123);
  const n = 50000;
  const xs = Array.from({ length: n }, () => gaussian(rng));
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  assert.ok(Math.abs(mean) < 0.02, `mean ${mean}`);
  assert.ok(Math.abs(variance - 1) < 0.03, `variance ${variance}`);
});

const baseMC = {
  startBalance: 1_000_000, annualContrib: 0, wageGrowth: 0, yrsToRet: 10, yrsInRet: 30,
  accumulation: { mu: 0.05, sigma: 0 }, decumulation: { mu: 0.05, sigma: 0 },
  withdrawal: () => 0, trials: 200,
};

test('Monte Carlo with zero volatility reproduces deterministic compounding', () => {
  const mc = runMonteCarlo(baseMC, mulberry32(1));
  assert.equal(mc.successRate, 1);
  close(mc.endings[0] / (1_000_000 * 1.05 ** 40), 1, 1e-9);
});

test('Monte Carlo: withdrawals larger than the portfolio always fail', () => {
  const mc = runMonteCarlo({ ...baseMC, withdrawal: () => 10_000_000 }, mulberry32(1));
  assert.equal(mc.successRate, 0);
  assert.ok(mc.endings.every((e) => e === 0));
});

test('Monte Carlo: success rate falls as spending rises', () => {
  const run = (spend) => runMonteCarlo({
    ...baseMC, accumulation: { mu: 0.07, sigma: 0.15 }, decumulation: { mu: 0.06, sigma: 0.10 },
    withdrawal: () => spend, trials: 1000,
  }, mulberry32(99)).successRate;
  const low = run(60000), mid = run(110000), high = run(160000);
  assert.ok(low > mid && mid > high, `${low} > ${mid} > ${high}`);
});

test('Monte Carlo: same seed → identical results', () => {
  const cfg = { ...baseMC, accumulation: { mu: 0.07, sigma: 0.15 }, decumulation: { mu: 0.06, sigma: 0.10 }, withdrawal: () => 90000 };
  assert.deepEqual(runMonteCarlo(cfg, mulberry32(5)), runMonteCarlo(cfg, mulberry32(5)));
});

test('quantile reads from an ascending array', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(quantile(xs, 0.5), 6);
  assert.equal(quantile(xs, 0.1), 2);
  assert.equal(quantile([], 0.5), 0);
});

test('retirement model: saving more or retiring later never lowers success (common random numbers)', () => {
  const base = buildModel(sample()).ret.successRate;
  const saveMore = buildModel(sample(), { whatIf: { retage: 62, extra: 25000, spend: 0, eq: 82 } }).ret.successRate;
  const retireLater = buildModel(sample(), { whatIf: { retage: 65, extra: 0, spend: 0, eq: 82 } }).ret.successRate;
  assert.ok(saveMore >= base, `${saveMore} >= ${base}`);
  assert.ok(retireLater >= base, `${retireLater} >= ${base}`);
});

test('retirement model: contribution capacity includes the right catch-up', () => {
  const r = (age) => buildModel(sample({ c1_age: age, c1_retage: Math.max(age + 1, 62) })).ret.cap1;
  assert.equal(r(47), 24500);
  assert.equal(r(52), 24500 + 8000);
  assert.equal(r(61), 24500 + 11250); // SECURE 2.0 ages 60–63 super catch-up
  assert.equal(r(64), 24500 + 8000);
});
