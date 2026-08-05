import { clamp } from "./format";

/** Visible window over the FFT span. Zoom 1 = full sample-rate width. */
export type SpectrumViewport = {
  zoom: number;
  /** Center of the view as an offset from the LO, in Hz. */
  centerOffsetHz: number;
};

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 48;

export const DEFAULT_VIEWPORT: SpectrumViewport = {
  zoom: 1,
  centerOffsetHz: 0,
};

export function viewSpanHz(sampleRate: number, zoom: number): number {
  return sampleRate / Math.max(zoom, MIN_ZOOM);
}

export function clampViewport(
  viewport: SpectrumViewport,
  sampleRate: number,
): SpectrumViewport {
  const zoom = clamp(viewport.zoom, MIN_ZOOM, MAX_ZOOM);
  const span = viewSpanHz(sampleRate, zoom);
  const maxCenter = Math.max(0, sampleRate / 2 - span / 2);
  return {
    zoom,
    centerOffsetHz: clamp(viewport.centerOffsetHz, -maxCenter, maxCenter),
  };
}

/** Map a horizontal CSS pixel to LO-relative offset (Hz). */
export function xToOffsetHz(
  x: number,
  width: number,
  sampleRate: number,
  viewport: SpectrumViewport,
): number {
  if (width <= 0) return 0;
  const span = viewSpanHz(sampleRate, viewport.zoom);
  const left = viewport.centerOffsetHz - span / 2;
  return left + (x / width) * span;
}

/** Map an LO-relative offset (Hz) to a horizontal CSS pixel. */
export function offsetHzToX(
  offsetHz: number,
  width: number,
  sampleRate: number,
  viewport: SpectrumViewport,
): number {
  const span = viewSpanHz(sampleRate, viewport.zoom);
  if (span <= 0) return width / 2;
  const left = viewport.centerOffsetHz - span / 2;
  return ((offsetHz - left) / span) * width;
}

/**
 * Zoom toward a focal LO-offset so the frequency under the cursor stays put.
 * `factor` > 1 zooms in.
 */
export function zoomViewportAt(
  viewport: SpectrumViewport,
  sampleRate: number,
  focalOffsetHz: number,
  factor: number,
): SpectrumViewport {
  const nextZoom = viewport.zoom * factor;
  const before = clampViewport(viewport, sampleRate);
  const after = clampViewport(
    { zoom: nextZoom, centerOffsetHz: before.centerOffsetHz },
    sampleRate,
  );

  const beforeSpan = viewSpanHz(sampleRate, before.zoom);
  const afterSpan = viewSpanHz(sampleRate, after.zoom);
  if (beforeSpan <= 0) return after;

  // Keep focalOffset at the same fractional position in the window.
  const frac =
    (focalOffsetHz - (before.centerOffsetHz - beforeSpan / 2)) / beforeSpan;
  const nextCenter = focalOffsetHz - (frac - 0.5) * afterSpan;
  return clampViewport(
    { zoom: after.zoom, centerOffsetHz: nextCenter },
    sampleRate,
  );
}

/** Pan the display window by a delta in Hz (positive = view moves up in freq). */
export function panViewport(
  viewport: SpectrumViewport,
  sampleRate: number,
  deltaHz: number,
): SpectrumViewport {
  return clampViewport(
    {
      zoom: viewport.zoom,
      centerOffsetHz: viewport.centerOffsetHz + deltaHz,
    },
    sampleRate,
  );
}

/** Nice tick step for a frequency axis spanning `spanHz`. */
export function axisTickStepHz(spanHz: number): number {
  const raw = spanHz / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const n = raw / pow;
  if (n < 1.5) return pow;
  if (n < 3.5) return 2 * pow;
  if (n < 7.5) return 5 * pow;
  return 10 * pow;
}

export function formatAxisHz(hz: number): string {
  const abs = Math.abs(hz);
  if (abs >= 1e6) return `${(hz / 1e6).toFixed(3)} M`;
  if (abs >= 1e3) return `${(hz / 1e3).toFixed(1)} k`;
  return `${Math.round(hz)}`;
}
