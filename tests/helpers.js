import { blankInputs } from '../src/ui/schema.js';
import { SAMPLE_CLIENT } from '../src/ui/sample-client.js';

/** A blank form with overrides applied — mirrors what the UI hands the engine. */
export const inputs = (overrides = {}) => blankInputs(overrides);

/** The Whitmore sample household, optionally tweaked. */
export const sample = (overrides = {}) => blankInputs({ ...structuredClone(SAMPLE_CLIENT), ...overrides });

/** A single W-2 earner with nothing else going on. */
export const simpleSingle = (overrides = {}) =>
  inputs({ c1_name: 'Test', c1_age: 35, c1_retage: 65, filing: 'Single', state: 'No-income-tax state', c1_salary: 100000, ...overrides });
