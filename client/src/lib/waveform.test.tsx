import { describe, expect, it } from "vitest";
import { fallbackWaveform, normalizeWaveform } from "./waveform";

describe("voice note waveform", () => {
  it("clamps stored loudness samples and preserves quiet/loud differences", () => {
    expect(normalizeWaveform([-1, 0.12, 0.9, 2, Number.NaN])).toEqual([0, 0.12, 0.9, 1, 0]);
  });

  it("limits waveform metadata to a compact browser-safe length", () => {
    expect(normalizeWaveform(Array.from({ length: 100 }, () => 0.5))).toHaveLength(80);
  });

  it("creates a stable fallback for older voice notes without samples", () => {
    expect(fallbackWaveform(12)).toEqual(fallbackWaveform(12));
    expect(fallbackWaveform(12)).toHaveLength(48);
  });
});
