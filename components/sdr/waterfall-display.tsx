"use client";

import { useCallback, useEffect, useRef } from "react";

import { useSpectrumStream } from "@/components/sdr/sdr-provider";
import {
  useSpectrumNav,
  type SpectrumNavHandlers,
} from "@/components/sdr/use-spectrum-nav";
import {
  dbRangeFor,
  getWaterfallPalette,
  waterfallFrameStride,
  waterfallRowsPerUpdate,
  type DbRangeId,
  type WaterfallDirectionId,
  type WaterfallPaletteId,
  type WaterfallSpeedId,
} from "@/lib/sdr/display-settings";
import { dbToPaletteIndex } from "@/lib/sdr/palette";
import {
  offsetHzToX,
  type SpectrumViewport,
  viewSpanHz,
} from "@/lib/sdr/spectrum-viewport";

type WaterfallDisplayProps = {
  sampleRate: number;
  frequencyHz: number;
  offsetHz: number;
  bandwidthHz: number;
  viewport: SpectrumViewport;
  onViewportChange: (next: SpectrumViewport) => void;
  onTuneOffset: (offsetHz: number) => void;
  onCenterOnOffset: (offsetHz: number) => void;
  onPanLo: (deltaHz: number) => void;
  paletteId: WaterfallPaletteId;
  speed: WaterfallSpeedId;
  direction: WaterfallDirectionId;
  dbRange: DbRangeId;
};

/**
 * Waterfall uses CSS-pixel resolution (not devicePixelRatio). Heatmap rows
 * don't benefit from retina density, and a 2× buffer was copying/uploading
 * ~4× more pixels every spectrum tick — enough to stall the audio thread.
 */
export function WaterfallDisplay({
  sampleRate,
  frequencyHz,
  offsetHz,
  bandwidthHz,
  viewport,
  onViewportChange,
  onTuneOffset,
  onCenterOnOffset,
  onPanLo,
  paletteId,
  speed,
  direction,
  dbRange,
}: WaterfallDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<HTMLCanvasElement | null>(null);
  const rowImageRef = useRef<ImageData | null>(null);
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const frameSkipRef = useRef(0);
  const accumRef = useRef<Float32Array | null>(null);
  const hasAccumRef = useRef(false);
  const readyRef = useRef(false);
  const rafRef = useRef(0);
  const sampleRateRef = useRef(sampleRate);
  sampleRateRef.current = sampleRate;
  const offsetRef = useRef(offsetHz);
  offsetRef.current = offsetHz;
  const bandwidthRef = useRef(bandwidthHz);
  bandwidthRef.current = bandwidthHz;

  const paletteRef = useRef(getWaterfallPalette(paletteId));
  paletteRef.current = getWaterfallPalette(paletteId);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const directionRef = useRef(direction);
  directionRef.current = direction;
  const dbRef = useRef(dbRangeFor(dbRange));
  dbRef.current = dbRangeFor(dbRange);

  const ensureHistory = useCallback((width: number, height: number) => {
    if (
      historyRef.current &&
      widthRef.current === width &&
      heightRef.current === height
    ) {
      return historyRef.current;
    }

    const history = historyRef.current ?? document.createElement("canvas");
    history.width = width;
    history.height = height;
    const hctx = history.getContext("2d");
    if (!hctx) return null;
    hctx.fillStyle = "#000";
    hctx.fillRect(0, 0, width, height);

    historyRef.current = history;
    widthRef.current = width;
    heightRef.current = height;
    rowImageRef.current = hctx.createImageData(width, 1);
    return history;
  }, []);

  const writeRow = useCallback(
    (
      row: Uint8ClampedArray,
      w: number,
      spectrum: Float32Array,
      sampleRateHz: number,
    ) => {
      const vp = viewportRef.current;
      const span = viewSpanHz(sampleRateHz, vp.zoom);
      const leftOffset = vp.centerOffsetHz - span / 2;
      const n = spectrum.length;
      const half = n / 2;
      const palette = paletteRef.current;
      const { minDb, maxDb } = dbRef.current;
      const denom = Math.max(w - 1, 1);

      for (let x = 0; x < w; x++) {
        const offsetAtX = leftOffset + (x / denom) * span;
        const frac = offsetAtX / sampleRateHz + 0.5;
        const i0 = Math.max(0, Math.min(n - 1, Math.floor(frac * (n - 1))));
        const db = spectrum[(i0 + half) % n];
        const color = palette[dbToPaletteIndex(db, minDb, maxDb)];
        const i = x * 4;
        row[i] = color[0];
        row[i + 1] = color[1];
        row[i + 2] = color[2];
        row[i + 3] = 255;
      }
    },
    [],
  );

  const paint = useCallback(() => {
    rafRef.current = 0;
    if (!readyRef.current) return;

    const source = accumRef.current;
    const canvas = canvasRef.current;
    if (!source || !canvas) return;

    const width = Math.max(1, Math.floor(canvas.clientWidth));
    const height = Math.max(1, Math.floor(canvas.clientHeight));
    if (width < 2 || height < 2) return;

    const rows = waterfallRowsPerUpdate(speedRef.current);
    const history = ensureHistory(width, height);
    const rowImage = rowImageRef.current;
    if (!history || !rowImage) return;

    const hctx = history.getContext("2d");
    if (!hctx) return;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newestAtTop = directionRef.current === "top";
    const rate = sampleRateRef.current;

    for (let r = 0; r < rows; r++) {
      writeRow(rowImage.data, width, source, rate);
      if (newestAtTop) {
        // Scroll history down; write newest row at y=0.
        hctx.drawImage(
          history,
          0,
          0,
          width,
          height - 1,
          0,
          1,
          width,
          height - 1,
        );
        hctx.putImageData(rowImage, 0, 0);
      } else {
        hctx.drawImage(
          history,
          0,
          1,
          width,
          height - 1,
          0,
          0,
          width,
          height - 1,
        );
        hctx.putImageData(rowImage, 0, height - 1);
      }
    }

    // Consume this stride window so the next frames start a fresh peak-hold.
    readyRef.current = false;
    hasAccumRef.current = false;

    ctx.drawImage(history, 0, 0);

    const vp = viewportRef.current;
    const span = viewSpanHz(rate, vp.zoom);
    const bwPx = (bandwidthRef.current / span) * width;
    const offsetPx = offsetHzToX(offsetRef.current, width, rate, vp);
    const loX = offsetHzToX(0, width, rate, vp);

    ctx.fillStyle = "oklch(0.62 0.18 355 / 0.08)";
    ctx.fillRect(offsetPx - bwPx / 2, 0, bwPx, height);

    if (loX >= -1 && loX <= width + 1) {
      ctx.strokeStyle = "oklch(0.78 0.12 195 / 0.4)";
      ctx.beginPath();
      ctx.moveTo(loX, 0);
      ctx.lineTo(loX, height);
      ctx.stroke();
    }

    ctx.strokeStyle = "oklch(0.70 0.20 355 / 0.7)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(offsetPx, 0);
    ctx.lineTo(offsetPx, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [ensureHistory, writeRow]);

  const schedulePaint = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(paint);
  }, [paint]);

  useSpectrumStream(
    useCallback(
      (spectrum) => {
        // Peak-hold across skipped frames for slow mode.
        if (!accumRef.current || accumRef.current.length !== spectrum.length) {
          accumRef.current = new Float32Array(spectrum.length);
          accumRef.current.set(spectrum);
          hasAccumRef.current = true;
        } else if (!hasAccumRef.current) {
          accumRef.current.set(spectrum);
          hasAccumRef.current = true;
        } else {
          const acc = accumRef.current;
          for (let i = 0; i < spectrum.length; i++) {
            const v = spectrum[i];
            if (v > acc[i]) acc[i] = v;
          }
        }

        frameSkipRef.current += 1;
        if (frameSkipRef.current < waterfallFrameStride(speedRef.current)) {
          return;
        }
        frameSkipRef.current = 0;
        readyRef.current = true;
        schedulePaint();
      },
      [schedulePaint],
    ),
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      historyRef.current = null;
      rowImageRef.current = null;
      widthRef.current = 0;
      heightRef.current = 0;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Clear waterfall history when the view window or look jumps.
  const viewKey = `${viewport.zoom.toFixed(3)}:${Math.round(viewport.centerOffsetHz)}:${paletteId}:${direction}:${dbRange}`;
  const prevViewKey = useRef(viewKey);
  useEffect(() => {
    if (prevViewKey.current === viewKey) return;
    prevViewKey.current = viewKey;
    historyRef.current = null;
    rowImageRef.current = null;
    widthRef.current = 0;
    heightRef.current = 0;
    frameSkipRef.current = 0;
    accumRef.current = null;
    hasAccumRef.current = false;
    readyRef.current = false;
  }, [viewKey]);

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
      className="h-full w-full touch-none outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
      style={{ cursor: nav.cursor }}
      role="img"
      tabIndex={nav.tabIndex}
      aria-label="RF waterfall. Click to tune, drag to pan, scroll to zoom, double-click to center."
      onPointerDown={nav.onPointerDown}
      onPointerMove={nav.onPointerMove}
      onPointerUp={nav.onPointerUp}
      onPointerCancel={nav.onPointerUp}
      onDoubleClick={nav.onDoubleClick}
    />
  );
}
