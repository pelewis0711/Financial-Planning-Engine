/**
 * Seeded pseudo-random numbers for the Monte Carlo engine.
 *
 * Using a seeded generator (instead of Math.random) makes results
 * reproducible, which matters for two reasons:
 *   1. Tests can assert exact outcomes.
 *   2. What-if scenarios are compared on the same simulated market paths
 *      ("common random numbers"), so a change in success rate reflects the
 *      decision being tested, not sampling noise.
 */

export const DEFAULT_SEED = 20260101;

/** Mulberry32: small, fast, well-distributed 32-bit PRNG. Returns () => [0, 1). */
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draw via the Box–Muller transform. */
export function gaussian(rng) {
  let u = 0, v = 0;
  while (!u) u = rng();
  while (!v) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
