/** CubeHelix palette for waterfall intensity (Green 2011). */
export type Rgb = [number, number, number];

export function cubeHelix(
  start = 2,
  rotations = 1,
  hue = 3,
  gamma = 1,
): Rgb[] {
  const palette: Rgb[] = new Array(256);
  for (let i = 0; i < 256; i++) {
    const fraction = i / 255;
    const g = Math.pow(fraction, gamma);
    const angle = 2 * Math.PI * (start / 3 + rotations * fraction);
    const amp = (hue * g * (1 - g)) / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const r = g + amp * (-0.14861 * cos + 1.78277 * sin);
    const gr = g + amp * (-0.29227 * cos - 0.90649 * sin);
    const b = g + amp * 1.97294 * cos;
    palette[i] = [
      Math.floor(Math.max(0, Math.min(255, 256 * r))),
      Math.floor(Math.max(0, Math.min(255, 256 * gr))),
      Math.floor(Math.max(0, Math.min(255, 256 * b))),
    ];
  }
  return palette;
}

export const WATERFALL_PALETTE = cubeHelix();

export function dbToPaletteIndex(
  db: number,
  minDb: number,
  maxDb: number,
): number {
  if (!Number.isFinite(db)) return 0;
  const t = (db - minDb) / (maxDb - minDb);
  return Math.max(0, Math.min(255, Math.floor(t * 255)));
}
