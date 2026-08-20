// splitmix32 — tiny seeded PRNG with full 2^32 period.
// Source: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
// Pure module: used by the build-time layout (seeded randomSource) and the
// glyph grammar (deterministic per-pattern arrangement).

/** Returns a deterministic () => number in [0, 1) for the given 32-bit seed. */
export function splitmix32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x9e3779b9) | 0
    let t = a ^ (a >>> 16)
    t = Math.imul(t, 0x21f0aaad)
    t = t ^ (t >>> 15)
    t = Math.imul(t, 0x735a2d97)
    return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296
  }
}
