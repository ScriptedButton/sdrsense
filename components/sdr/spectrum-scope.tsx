"use client";

import { useCallback, useEffect, useRef } from "react";

import { useSpectrumStream } from "@/components/sdr/sdr-provider";
import { MIN_DB, MAX_DB } from "@/lib/sdr/types";

type SpectrumScopeProps = {
  sampleRate: number;
  frequencyHz: number;
  offsetHz: number;
  bandwidthHz: number;
  onTuneOffset?: (offsetHz: number) => void;
};

export function SpectrumScope({
  sampleRate,
  frequencyHz,
  offsetHz,
  bandwidthHz,
  onTuneOffset,
}: SpectrumScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestRef = useRef<Float32Array | null>(null);
  const centerRef = useRef<number | undefined>(undefined);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const spectrum = latestRef.current;
    if (!canvas || !spectrum) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "oklch(0.08 0 0)";
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = "oklch(0.22 0.01 355)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (height * i) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let i = 1; i < 8; i++) {
      const x = (width * i) / 8;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    const n = spectrum.length;
    const half = n / 2;
    const dbRange = MAX_DB - MIN_DB;

    // Bandwidth highlight around offset
    const bwPx = (bandwidthHz / sampleRate) * width;
    const offsetPx = width / 2 + (offsetHz / sampleRate) * width;
    ctx.fillStyle = "oklch(0.62 0.18 355 / 0.12)";
    ctx.fillRect(offsetPx - bwPx / 2, 0, bwPx, height);

    // Center / tune markers
    ctx.strokeStyle = "oklch(0.78 0.12 195 / 0.55)";
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    ctx.strokeStyle = "oklch(0.70 0.20 355)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(offsetPx, 0);
    ctx.lineTo(offsetPx, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Spectrum line
    ctx.beginPath();
    ctx.strokeStyle = "oklch(0.82 0.14 195)";
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "oklch(0.78 0.12 195 / 0.18)";

    for (let i = 0; i < n; i++) {
      const bin = spectrum[(i + half) % n];
      const db = Number.isFinite(bin) ? bin : MIN_DB;
      const x = (i / (n - 1)) * width;
      const y = height - ((db - MIN_DB) / dbRange) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Axis labels
    ctx.fillStyle = "oklch(0.62 0.02 355)";
    ctx.font = "11px var(--font-mono), ui-monospace, monospace";
    const center = centerRef.current ?? frequencyHz;
    const leftHz = center - sampleRate / 2;
    const rightHz = center + sampleRate / 2;
    ctx.fillText(formatAxis(leftHz), 6, height - 6);
    ctx.fillText(formatAxis(center), width / 2 - 28, height - 6);
    const rightLabel = formatAxis(rightHz);
    ctx.fillText(rightLabel, width - ctx.measureText(rightLabel).width - 6, height - 6);
    ctx.fillText(`${MAX_DB} dB`, 6, 14);
    ctx.fillText(`${MIN_DB} dB`, 6, height - 22);
  }, [bandwidthHz, frequencyHz, offsetHz, sampleRate]);

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
      latestRef.current = spectrum.slice();
      centerRef.current = centerHz;
    }, []),
  );

  const handlePointer = (clientX: number) => {
    if (!onTuneOffset || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const fraction = x / rect.width - 0.5;
    onTuneOffset(Math.round(fraction * sampleRate));
  };

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full cursor-crosshair touch-none"
      role="img"
      aria-label="RF spectrum scope"
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        handlePointer(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons !== 1) return;
        handlePointer(e.clientX);
      }}
    />
  );
}

function formatAxis(hz: number): string {
  if (Math.abs(hz) >= 1e6) return `${(hz / 1e6).toFixed(3)} M`;
  if (Math.abs(hz) >= 1e3) return `${(hz / 1e3).toFixed(1)} k`;
  return `${Math.round(hz)}`;
}
