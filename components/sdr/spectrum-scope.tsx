"use client";

import { useCallback, useEffect, useRef } from "react";

import { useSpectrumStream } from "@/components/sdr/sdr-provider";
import {
  useSpectrumNav,
  type SpectrumNavHandlers,
} from "@/components/sdr/use-spectrum-nav";
import {
  drawSignalMarkers,
  type SignalMarker,
} from "@/lib/sdr/signal-id/scope-overlay";
import {
  axisTickStepHz,
  formatAxisHz,
  offsetHzToX,
  type SpectrumViewport,
  viewSpanHz,
} from "@/lib/sdr/spectrum-viewport";
import { dbRangeFor, type DbRangeId, type NoiseFilterId } from "@/lib/sdr/display-settings";
import { SpectrumNoiseFilter } from "@/lib/sdr/spectrum-noise-filter";

type SpectrumScopeProps = {
  sampleRate: number;
  frequencyHz: number;
  offsetHz: number;
  bandwidthHz: number;
  viewport: SpectrumViewport;
  onViewportChange: (next: SpectrumViewport) => void;
  onTuneOffset: (offsetHz: number) => void;
  onCenterOnOffset: (offsetHz: number) => void;
  onPanLo: (deltaHz: number) => void;
  dbRange: DbRangeId;
  noiseFilter?: NoiseFilterId;
  /** Identified signals to annotate over the trace. */
  markers?: SignalMarker[];
};

export function SpectrumScope({
  sampleRate,
  frequencyHz,
  offsetHz,
  bandwidthHz,
  viewport,
  onViewportChange,
  onTuneOffset,
  onCenterOnOffset,
  onPanLo,
  dbRange,
  noiseFilter = "off",
  markers,
}: SpectrumScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestRef = useRef<Float32Array | null>(null);
  const centerRef = useRef<number | undefined>(undefined);
  const rafRef = useRef<number>(0);
  const dirtyRef = useRef(true);
  const markersRef = useRef<SignalMarker[]>([]);
  markersRef.current = markers ?? [];
  const noiseFilterRef = useRef(new SpectrumNoiseFilter());
  const noiseStrengthRef = useRef(noiseFilter);
  noiseStrengthRef.current = noiseFilter;

  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const dbRef = useRef(dbRangeFor(dbRange));
  dbRef.current = dbRangeFor(dbRange);
  const sampleRateRef = useRef(sampleRate);
  sampleRateRef.current = sampleRate;
  const frequencyRef = useRef(frequencyHz);
  frequencyRef.current = frequencyHz;
  const offsetRef = useRef(offsetHz);
  offsetRef.current = offsetHz;
  const bandwidthRef = useRef(bandwidthHz);
  bandwidthRef.current = bandwidthHz;

  // Props that affect the trace/overlays — mark dirty without reallocating draw.
  useEffect(() => {
    dirtyRef.current = true;
  }, [bandwidthHz, frequencyHz, offsetHz, sampleRate, viewport, dbRange, markers, noiseFilter]);

  useEffect(() => {
    noiseFilterRef.current.reset();
    dirtyRef.current = true;
  }, [noiseFilter]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const spectrum = latestRef.current;
    if (!canvas || !spectrum) return;
    if (!dirtyRef.current) return;
    dirtyRef.current = false;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    const targetW = Math.floor(width * dpr);
    const targetH = Math.floor(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const vp = viewportRef.current;
    const { minDb, maxDb } = dbRef.current;
    const rate = sampleRateRef.current;
    const freq = frequencyRef.current;
    const offset = offsetRef.current;
    const bandwidth = bandwidthRef.current;
    const span = viewSpanHz(rate, vp.zoom);
    const toX = (off: number) => offsetHzToX(off, width, rate, vp);
    const hzToPx = (hz: number) => (hz / span) * width;

    ctx.fillStyle = "oklch(0.08 0 0)";
    ctx.fillRect(0, 0, width, height);

    // Grid — horizontal always; vertical from frequency ticks
    ctx.strokeStyle = "oklch(0.22 0.01 355)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (height * i) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const center = centerRef.current ?? freq;
    const leftHz = center + vp.centerOffsetHz - span / 2;
    const rightHz = leftHz + span;
    const step = axisTickStepHz(span);
    const firstTick = Math.ceil(leftHz / step) * step;

    ctx.font = "11px var(--font-mono), ui-monospace, monospace";

    for (let f = firstTick; f <= rightHz + 1; f += step) {
      const x = toX(f - center);
      ctx.strokeStyle = "oklch(0.22 0.01 355)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      const label = formatAxisHz(f);
      const tw = ctx.measureText(label).width;
      const lx = Math.min(Math.max(x - tw / 2, 4), width - tw - 4);
      ctx.fillStyle = "oklch(0.62 0.02 355)";
      ctx.fillText(label, lx, height - 6);
    }

    const n = spectrum.length;
    const half = n / 2;
    const dbSpan = maxDb - minDb;

    // Bandwidth highlight around offset
    const bwPx = hzToPx(bandwidth);
    const offsetPx = toX(offset);
    ctx.fillStyle = "oklch(0.62 0.18 355 / 0.12)";
    ctx.fillRect(offsetPx - bwPx / 2, 0, bwPx, height);

    // LO center marker (only when visible)
    const loX = toX(0);
    if (loX >= -1 && loX <= width + 1) {
      ctx.strokeStyle = "oklch(0.78 0.12 195 / 0.55)";
      ctx.beginPath();
      ctx.moveTo(loX, 0);
      ctx.lineTo(loX, height);
      ctx.stroke();
    }

    ctx.strokeStyle = "oklch(0.70 0.20 355)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(offsetPx, 0);
    ctx.lineTo(offsetPx, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Spectrum line — sample bins across the visible window
    ctx.beginPath();
    ctx.strokeStyle = "oklch(0.82 0.14 195)";
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "oklch(0.78 0.12 195 / 0.18)";

    const leftOffset = vp.centerOffsetHz - span / 2;
    const denom = Math.max(width - 1, 1);
    for (let px = 0; px < width; px++) {
      const offsetAtX = leftOffset + (px / denom) * span;
      const frac = offsetAtX / rate + 0.5;
      const binFloat = frac * (n - 1);
      const i0 = Math.floor(binFloat);
      const i1 = Math.min(Math.max(i0, 0) + 1, n - 1);
      const t = binFloat - i0;
      // fftshift: display index i reads spectrum[(i + half) % n]
      const shifted0 = spectrum[(((Math.max(i0, 0) % n) + n) % n + half) % n];
      const shifted1 = spectrum[(i1 + half) % n];
      const dbRaw = shifted0 * (1 - t) + shifted1 * t;
      const db = Number.isFinite(dbRaw) ? dbRaw : minDb;
      const y = height - ((db - minDb) / dbSpan) * height;
      if (px === 0) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "oklch(0.62 0.02 355)";
    ctx.fillText(`${maxDb} dB`, 6, 14);
    ctx.fillText(`${minDb} dB`, 6, height - 22);

    drawSignalMarkers(ctx, {
      markers: markersRef.current,
      width,
      height,
      offsetToX: toX,
      hzToPx,
    });
  }, []);

  useEffect(() => {
    const loop = () => {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  useSpectrumStream(
    useCallback((spectrum, centerHz) => {
      const filtered = noiseFilterRef.current.apply(
        spectrum,
        noiseStrengthRef.current,
      );
      if (!latestRef.current || latestRef.current.length !== filtered.length) {
        latestRef.current = new Float32Array(filtered.length);
      }
      latestRef.current.set(filtered);
      centerRef.current = centerHz;
      dirtyRef.current = true;
    }, []),
  );

  const navHandlers: SpectrumNavHandlers = {
    onTuneOffset,
    onCenterOnOffset,
    onPanLo,
    viewport,
    onViewportChange,
    sampleRate,
    frequencyHz,
    offsetHz,
    bandwidthHz,
  };

  const nav = useSpectrumNav(canvasRef, navHandlers);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full touch-none"
      style={{ cursor: nav.cursor }}
      role="img"
      aria-label="RF spectrum scope. Click to tune, drag to pan, scroll to zoom, double-click to center."
      onPointerDown={nav.onPointerDown}
      onPointerMove={nav.onPointerMove}
      onPointerUp={nav.onPointerUp}
      onPointerCancel={nav.onPointerUp}
      onDoubleClick={nav.onDoubleClick}
    />
  );
}
