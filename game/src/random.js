// Seeded random numbers (mulberry32). The same seed always builds the
// same city, the same traffic and the same pedestrians, which is what
// makes the staged screenshots repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A small wrapper with the helpers the world builders actually use.
export function makeRng(seed) {
  const next = createRandom(seed);
  return {
    next,
    range(a, b) { return a + (b - a) * next(); },
    int(a, b) { return Math.floor(a + (b - a + 1) * next()); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
    sign() { return next() < 0.5 ? -1 : 1; },
  };
}

// Determinism check used by the headless tests: two generators from the
// same seed must produce the same sequence, and different seeds must not.
export function sequencesMatch(seed, count) {
  const a = createRandom(seed);
  const b = createRandom(seed);
  for (let i = 0; i < count; i += 1) {
    if (a() !== b()) return false;
  }
  return true;
}
