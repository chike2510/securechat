export function normalizeWaveform(levels: number[] | undefined, max = 80) {
  if (!levels?.length) return [];
  return levels.slice(0, max).map(level => Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0)));
}

export function fallbackWaveform(seedValue: number, count = 48) {
  let seed = seedValue * 17;
  return Array.from({ length: count }, (_, index) => {
    seed = (seed * 31 + index * 13) % 97;
    return 0.16 + (seed % 54) / 100;
  });
}
