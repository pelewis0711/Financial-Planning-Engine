import { test } from 'node:test';
import assert from 'node:assert/strict';
import { irmaaTier, computeRothLadder, firstRmdDivisor } from '../src/engine/roth-ladder.js';
import { taxFromBrackets } from '../src/engine/tax.js';
import { T26 } from '../src/engine/params/ty2026.js';
import { buildModel } from '../src/engine/model.js';
import { sample } from './helpers.js';

test('IRMAA: standard premium at or below the first threshold', () => {
  assert.deepEqual(irmaaTier(218000, 'Married Filing Jointly'), { tier: 0, prem: 202.90, surchargeAnnual: 0 });
  assert.equal(irmaaTier(109000, 'Single').tier, 0);
});

test('IRMAA: $1 over a threshold triggers the full next tier (cliff)', () => {
  const t = irmaaTier(218001, 'Married Filing Jointly');
  assert.equal(t.tier, 1);
  assert.equal(t.prem, 284.10);
  assert.ok(Math.abs(t.surchargeAnnual - (284.10 - 202.90) * 12) < 1e-9);
});

test('IRMAA: tier 4 premium is $649.20 (CMS 2026)', () => {
  assert.equal(irmaaTier(500000, 'Married Filing Jointly').prem, 649.20);
  assert.equal(irmaaTier(300000, 'Single').prem, 649.20);
});

test('IRMAA: top tier is inclusive at its threshold', () => {
  assert.equal(irmaaTier(749999, 'Married Filing Jointly').tier, 4);
  assert.equal(irmaaTier(750000, 'Married Filing Jointly').tier, 5);
  assert.equal(irmaaTier(500000, 'Single').tier, 5);
});

test('IRMAA: head of household uses the single schedule; MFS has its own', () => {
  assert.deepEqual(irmaaTier(150000, 'Head of Household'), irmaaTier(150000, 'Single'));
  assert.equal(irmaaTier(110000, 'Married Filing Separately').prem, 649.20);
  assert.equal(irmaaTier(391000, 'Married Filing Separately').prem, 689.90);
});

test('first RMD divisor: 26.5 at 73, 24.6 at 75 (Uniform Lifetime Table)', () => {
  assert.equal(firstRmdDivisor(73), 26.5);
  assert.equal(firstRmdDivisor(75), 24.6);
});

test('Roth ladder: never converts past the top of the 24% bracket', () => {
  const M = buildModel(sample());
  const { ladder } = M;
  assert.ok(ladder && ladder.rows.length > 0);
  const stdDed = T26.stdDed[M.tax.fs];
  for (const row of ladder.rows) {
    assert.ok(row.conv >= 0);
    assert.ok(row.conv <= row.bal + 1e-6, 'cannot convert more than the balance');
    // Marginal rate on the conversion never exceeds 24%.
    assert.ok(row.effRate <= 0.24 + 1e-9, `effective rate ${row.effRate}`);
  }
  assert.equal(ladder.top24, 403550);
  assert.ok(stdDed > 0);
});

test('Roth ladder: conversions shrink the first RMD and never raise the IRMAA tier', () => {
  const { ladder } = buildModel(sample());
  assert.ok(ladder.rmdWith < ladder.rmdWithout);
  assert.ok(ladder.irmWith.tier <= ladder.irmWithout.tier);
  assert.ok(ladder.irmSavings >= 0);
});

test('Roth ladder: conversion tax equals bracket arithmetic', () => {
  const { ladder, tax } = buildModel(sample());
  const br = T26.brackets[tax.fs];
  const first = ladder.rows[0];
  // With no SS or pension in year one of retirement, base ordinary income is 0.
  const expected = taxFromBrackets(first.conv, br);
  assert.ok(Math.abs(first.taxCost - expected) < 0.01);
});

test('Roth ladder: skipped when there is no pre-tax money', () => {
  const M = buildModel(sample({ c1_401k: 0, c2_401k: 0, c1_trad_ira: 0, c2_trad_ira: 0 }));
  assert.equal(computeRothLadder(M.d, M.tax, M.ret, M.a), null);
});
