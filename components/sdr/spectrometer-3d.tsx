"use client";

import { useCallback, useEffect, useRef } from "react";

import { useSpectrumStream } from "@/components/sdr/sdr-provider";
import { Spectrometer3DScene } from "@/lib/sdr/spectrometer-3d-scene";

type Spectrometer3DProps = {
  sampleRate: number;
  offsetHz: number;
  bandwidthHz: number;
  onTuneOffset?: (offsetHz: number) => void;
};

export function Spectrometer3D({
  sampleRate,
  offsetHz,
  bandwidthHz,
  onTuneOffset,
}: Spectrometer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Spectrometer3DScene | null>(null);
  const sampleRateRef = useRef(sampleRate);
  const onTuneRef = useRef(onTuneOffset);
  sampleRateRef.current = sampleRate;
  onTuneRef.current = onTuneOffset;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const scene = new Spectrometer3DScene({
      canvas,
      reducedMotion,
      onTuneFraction: (fraction) => {
        onTuneRef.current?.(Math.round(fraction * sampleRateRef.current));
      },
    });
    sceneRef.current = scene;

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setTuneMarkers(offsetHz, bandwidthHz, sampleRate);
  }, [bandwidthHz, offsetHz, sampleRate]);

  useSpectrumStream(
    useCallback((spectrum) => {
      sceneRef.current?.pushSpectrum(spectrum);
    }, []),
  );

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full touch-none"
      role="img"
      aria-label="3D RF spectrometer. Drag to orbit, scroll to zoom, click to tune."
    />
  );
}
