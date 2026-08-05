"use client";

import { useCallback, useEffect, useRef } from "react";

import { useSpectrumStream } from "@/components/sdr/sdr-provider";
import { WATERFALL_PALETTE, dbToPaletteIndex } from "@/lib/sdr/palette";
import { MAX_DB, MIN_DB } from "@/lib/sdr/types";

type WaterfallDisplayProps = {
  sampleRate: number;
  offsetHz: number;
  bandwidthHz: number;
};

export function WaterfallDisplay({
  sampleRate,
  offsetHz,
  bandwidthHz,
}: WaterfallDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const widthRef = useRef(0);

  const ensureBuffer = useCallback((width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.floor(width * dpr);
    const targetH = Math.floor(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      imageDataRef.current = null;
      widthRef.current = 0;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    if (!imageDataRef.current || widthRef.current !== targetW) {
      imageDataRef.current = ctx.createImageData(targetW, targetH);
      imageDataRef.current.data.fill(0);
      widthRef.current = targetW;
    }
    return ctx;
  }, []);

  useSpectrumStream(
    useCallback(
      (spectrum) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (width < 2 || height < 2) return;

        const ctx = ensureBuffer(width, height);
        const image = imageDataRef.current;
        if (!ctx || !image) return;

        const w = image.width;
        const h = image.height;
        const rowBytes = w * 4;

        // Scroll down one pixel row
        image.data.copyWithin(rowBytes, 0, rowBytes * (h - 1));

        const n = spectrum.length;
        const half = n / 2;
        const row = image.data;
        for (let x = 0; x < w; x++) {
          const binIndex = Math.floor((x / (w - 1)) * (n - 1));
          const db = spectrum[(binIndex + half) % n];
          const color = WATERFALL_PALETTE[dbToPaletteIndex(db, MIN_DB, MAX_DB)];
          const i = x * 4;
          row[i] = color[0];
          row[i + 1] = color[1];
          row[i + 2] = color[2];
          row[i + 3] = 255;
        }

        ctx.putImageData(image, 0, 0);

        // Overlay bandwidth / tune markers in CSS pixels
        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const cssW = width;
        const cssH = height;
        const bwPx = (bandwidthHz / sampleRate) * cssW;
        const offsetPx = cssW / 2 + (offsetHz / sampleRate) * cssW;

        ctx.fillStyle = "oklch(0.62 0.18 355 / 0.08)";
        ctx.fillRect(offsetPx - bwPx / 2, 0, bwPx, cssH);

        ctx.strokeStyle = "oklch(0.78 0.12 195 / 0.4)";
        ctx.beginPath();
        ctx.moveTo(cssW / 2, 0);
        ctx.lineTo(cssW / 2, cssH);
        ctx.stroke();

        ctx.strokeStyle = "oklch(0.70 0.20 355 / 0.7)";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(offsetPx, 0);
        ctx.lineTo(offsetPx, cssH);
        ctx.stroke();
        ctx.restore();
      },
      [bandwidthHz, ensureBuffer, offsetHz, sampleRate],
    ),
  );

  useEffect(() => {
    const onResize = () => {
      imageDataRef.current = null;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      role="img"
      aria-label="RF waterfall"
    />
  );
}
