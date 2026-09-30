import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taxFromBrackets, marginalRate, ltcgTax, computeTax } from '../src/engine/tax.js';
import { T26, FILING_STATUSES } from '../src/engine/params/ty2026.js';
import { simpleSingle, inputs } from './helpers.js';

const MFJ = T26.brackets['Married Filing Jointly'];
const close = (actual, expected, tol = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${expected}, got ${actual}`);

test('bracket tables are well-formed for every filing status', () => {
  for (const fs of FILING_STATUSES) {
    for (const table of [T26.brackets[fs], T26.ltcg[fs]]) {
      assert.equal(table[0][0], 0, `${fs} starts at 0`);
      for (let i = 1; i < table.length; i++) {
        assert.ok(table[i][0] > table[i - 1][0], `${fs} thresholds ascend`);
        assert.ok(table[i][1] > table[i - 1][1], `${fs} rates ascend`);
      }
    }
    assert.ok(T26.stdDed[fs] > 0);
  }
});

test('taxFromBrackets: zero and negative income owe nothing', () => {
  assert.equal(taxFromBrackets(0, MFJ), 0);
  assert.equal(taxFromBrackets(-5000, MFJ), 0);
});

test('taxFromBrackets: MFJ tax at the top of the 22% bracket', () => {
  // 24,800 × 10% + 76,000 × 12% + 110,600 × 22%
  close(taxFromBrackets(211400, MFJ), 2480 + 9120 + 24332);
});

test('taxFromBrackets is continuous across a bracket boundary', () => {
  const below = taxFromBrackets(211400, MFJ);
  close(taxFromBrackets(211401, MFJ) - below, 0.24);
});

test('marginalRate picks the bracket containing the last dollar', () => {
  assert.equal(marginalRate(24800, MFJ), 0.10); // boundary belongs to the lower bracket
  assert.equal(marginalRate(24801, MFJ), 0.12);
  assert.equal(marginalRate(1_000_000, MFJ), 0.37);
});

test('ltcgTax stacks preferential income on top of ordinary income', () => {
  // Single: 0% up to 49,450. With 40,000 of ordinary income, the first 9,450
  // of gains are tax-free and the next 10,550 are taxed at 15%.
  close(ltcgTax(40000, 20000, 'Single'), 10550 * 0.15);
  assert.equal(ltcgTax(0, 49450, 'Single'), 0);
});

test('computeTax: single W-2 earner, $100k, no state tax', () => {
  const t = computeTax(simpleSingle());
  assert.equal(t.agi, 100000);
  assert.equal(t.taxableIncome, 100000 - 16100);
  close(t.ordTax, 1240 + 4560 + 7370);        // 10% / 12% / 22% slices of 83,900
  close(t.fica, 100000 * 0.0765);
  assert.equal(t.marginalFed, 0.22);
  assert.equal(t.room24, 201775 - 83900);
  assert.equal(t.stateIncTax, 0);
});

test('computeTax: Illinois flat 4.95% on AGI', () => {
  close(computeTax(simpleSingle({ state: 'IL' })).stateIncTax, 4950);
});

test('computeTax: pre-tax 401(k) deferral reduces AGI; Roth does not', () => {
  const pre = computeTax(simpleSingle({ c1_401k_contrib: 20000, c1_401k_type: 'Traditional (pre-tax)' }));
  const roth = computeTax(simpleSingle({ c1_401k_contrib: 20000, c1_401k_type: 'Roth' }));
  const split = computeTax(simpleSingle({ c1_401k_contrib: 20000, c1_401k_type: 'Split' }));
  assert.equal(pre.agi, 80000);
  assert.equal(roth.agi, 100000);
  assert.equal(split.agi, 90000);
});

test('computeTax: FICA Social Security portion caps at the wage base', () => {
  const t = computeTax(simpleSingle({ c1_salary: 300000 }));
  close(t.fica, T26.fica.ssWageBase * 0.062 + 300000 * 0.0145);
});

test('computeTax: NIIT applies only above the threshold', () => {
  const under = computeTax(simpleSingle({ c1_salary: 150000, interest_income: 20000 }));
  const over = computeTax(simpleSingle({ c1_salary: 250000, interest_income: 20000 }));
  assert.equal(under.niit, 0);
  close(over.niit, 20000 * 0.038);
});

test('computeTax: self-employment tax on 92.35% of net SE income', () => {
  const t = computeTax(inputs({ c1_name: 'SE', c1_age: 40, filing: 'Single', se_income: 100000 }));
  close(t.seTax, 100000 * 0.9235 * 0.153);
});

test('computeTax: 65+ filers get the extra standard deduction and OBBBA senior deduction', () => {
  const t = computeTax(simpleSingle({ c1_age: 67, c1_salary: 60000 }));
  assert.equal(t.stdDed, 16100 + 2050);
  assert.equal(t.seniorDed, 6000);
  const phased = computeTax(simpleSingle({ c1_age: 67, c1_salary: 125000 }));
  close(phased.seniorDed, 6000 - (125000 - 75000) * 0.06);
});

test('computeTax: child tax credit phases out $50 per $1,000 over the threshold', () => {
  const kids = [{ name: 'A', age: 5 }, { name: 'B', age: 8 }];
  const full = computeTax(simpleSingle({ children: kids }));
  assert.equal(full.ctc, 4400);
  const phased = computeTax(simpleSingle({ children: kids, c1_salary: 230000 }));
  assert.equal(phased.ctc, 4400 - 30 * 50);
});
