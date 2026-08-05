"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import {
  clampViewport,
  offsetHzToX,
  panViewport,
  type SpectrumViewport,
  viewSpanHz,
  xToOffsetHz,
  zoomViewportAt,
} from "@/lib/sdr/spectrum-viewport";

export type SpectrumNavHandlers = {
  onTuneOffset: (offsetHz: number) => void;
  onCenterOnOffset: (offsetHz: number) => void;
  onPanLo: (deltaHz: number) => void;
  viewport: SpectrumViewport;
  onViewportChange: (next: SpectrumViewport) => void;
  sampleRate: number;
  frequencyHz: number;
  offsetHz: number;
  bandwidthHz: number;
};

type DragMode = "tune" | "pan-view" | "pan-lo";

type DragState = {
  /** Active gesture, or null until movement exceeds click slop. */
  mode: DragMode | null;
  /** Gesture that starts once the pointer moves past click slop. */
  dragMode: DragMode;
  /** When true, a stationary release tunes instead of panning. */
  clickTunes: boolean;
  pointerId: number;
  startX: number;
  lastX: number;
};

const TUNE_GRAB_PX = 14;
const LO_PAN_MIN_HZ = 500;
/** Pixels of movement before a press becomes a drag (avoids accidental LO pan). */
const CLICK_SLOP_PX = 5;

/**
 * Shared pointer + wheel navigation for spectrum and waterfall canvases.
 *
 * - Click anywhere: tune VFO to that frequency
 * - Drag near the passband: scrub the VFO
 * - Drag elsewhere (or when zoomed): pan the view; at 1× zoom, pan the LO
 * - Shift / middle-drag: always pan the LO
 * - Wheel: zoom toward cursor
 * - Double-click: center LO on that frequency
 */
export function useSpectrumNav(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  {
    onTuneOffset,
    onCenterOnOffset,
    onPanLo,
    viewport,
    onViewportChange,
    sampleRate,
    offsetHz,
    bandwidthHz,
  }: SpectrumNavHandlers,
) {
  const viewportRef = useRef(viewport);
  const sampleRateRef = useRef(sampleRate);
  const offsetRef = useRef(offsetHz);
  const bandwidthRef = useRef(bandwidthHz);
  const dragRef = useRef<DragState | null>(null);
  const loPanAccumRef = useRef(0);
  const loPanPendingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [activeMode, setActiveMode] = useState<DragMode | null>(null);

  viewportRef.current = viewport;
  sampleRateRef.current = sampleRate;
  offsetRef.current = offsetHz;
  bandwidthRef.current = bandwidthHz;

  const flushLoPan = useCallback(() => {
    loPanPendingRef.current = false;
    const delta = loPanAccumRef.current;
    if (Math.abs(delta) < LO_PAN_MIN_HZ) return;
    loPanAccumRef.current = 0;
    onPanLo(Math.round(delta));
  }, [onPanLo]);

  const queueLoPan = useCallback(
    (deltaHz: number) => {
      loPanAccumRef.current += deltaHz;
      if (loPanPendingRef.current) return;
      loPanPendingRef.current = true;
      requestAnimationFrame(flushLoPan);
    },
    [flushLoPan],
  );

  const clientToOffset = useCallback(
    (clientX: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return 0;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      return xToOffsetHz(
        x,
        rect.width,
        sampleRateRef.current,
        viewportRef.current,
      );
    },
    [canvasRef],
  );

  /**
   * Decide what a *drag* should do. Clicks always tune (primary button,
   * no modifiers) so selecting a scan marker does not retune the LO.
   */
  const pickDragMode = useCallback(
    (clientX: number, shiftKey: boolean, button: number): DragMode => {
      if (shiftKey || button === 1) return "pan-lo";

      const canvas = canvasRef.current;
      if (!canvas) return "tune";
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const vp = viewportRef.current;
      const rate = sampleRateRef.current;
      const tuneX = offsetHzToX(offsetRef.current, rect.width, rate, vp);
      const bwPx = Math.max(
        (bandwidthRef.current / viewSpanHz(rate, vp.zoom)) * rect.width,
        8,
      );
      const nearTune = Math.abs(x - tuneX) <= Math.max(TUNE_GRAB_PX, bwPx / 2);

      if (nearTune) return "tune";
      if (vp.zoom > 1.02) return "pan-view";
      return "pan-lo";
    },
    [canvasRef],
  );

  const applyMode = useCallback(
    (mode: DragMode, clientX: number, deltaHz: number) => {
      if (mode === "tune") {
        onTuneOffset(Math.round(clientToOffset(clientX)));
        return;
      }
      if (mode === "pan-view") {
        onViewportChange(
          panViewport(viewportRef.current, sampleRateRef.current, deltaHz),
        );
        return;
      }
      queueLoPan(deltaHz);
    },
    [clientToOffset, onTuneOffset, onViewportChange, queueLoPan],
  );

  const commitDrag = useCallback(
    (drag: DragState, clientX: number, deltaHz: number) => {
      drag.mode = drag.dragMode;
      setDragging(true);
      setActiveMode(drag.dragMode);
      applyMode(drag.dragMode, clientX, deltaHz);
    },
    [applyMode],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0 && e.button !== 1) return;
      e.currentTarget.focus({ preventScroll: true });
      e.currentTarget.setPointerCapture(e.pointerId);

      const dragMode = pickDragMode(e.clientX, e.shiftKey, e.button);
      // Primary click (no shift) always tunes on release if the pointer stays still.
      const clickTunes = e.button === 0 && !e.shiftKey;
      // Grabbing the passband starts tuning immediately so scrubbing feels instant.
      const startImmediately = dragMode === "tune";

      dragRef.current = {
        mode: startImmediately ? "tune" : null,
        dragMode,
        clickTunes,
        pointerId: e.pointerId,
        startX: e.clientX,
        lastX: e.clientX,
      };

      if (startImmediately) {
        setDragging(true);
        setActiveMode("tune");
        onTuneOffset(Math.round(clientToOffset(e.clientX)));
      } else {
        setDragging(false);
        setActiveMode(null);
      }
    },
    [clientToOffset, onTuneOffset, pickDragMode],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const dx = e.clientX - drag.lastX;
      drag.lastX = e.clientX;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const width = canvas.getBoundingClientRect().width;
      const rate = sampleRateRef.current;
      const vp = viewportRef.current;
      const hzPerPx = viewSpanHz(rate, vp.zoom) / width;
      const deltaHz = -dx * hzPerPx;

      if (drag.mode === null) {
        if (Math.abs(e.clientX - drag.startX) < CLICK_SLOP_PX) return;
        // Include movement since press so the first pan step isn't lost.
        const totalDx = e.clientX - drag.startX;
        const totalDeltaHz = -totalDx * hzPerPx;
        commitDrag(drag, e.clientX, totalDeltaHz);
        return;
      }

      applyMode(drag.mode, e.clientX, deltaHz);
    },
    [applyMode, canvasRef, commitDrag],
  );

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      setDragging(false);
      setActiveMode(null);

      // Stationary (or near-stationary) primary press → tune, never pan.
      if (drag.mode === null && drag.clickTunes) {
        loPanAccumRef.current = 0;
        onTuneOffset(Math.round(clientToOffset(e.clientX)));
        return;
      }

      if (Math.abs(loPanAccumRef.current) >= LO_PAN_MIN_HZ) {
        flushLoPan();
      } else {
        loPanAccumRef.current = 0;
      }
    },
    [clientToOffset, flushLoPan, onTuneOffset],
  );

  const onDoubleClick = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      onCenterOnOffset(Math.round(clientToOffset(e.clientX)));
      onViewportChange(
        clampViewport({ zoom: 1, centerOffsetHz: 0 }, sampleRateRef.current),
      );
    },
    [clientToOffset, onCenterOnOffset, onViewportChange],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const focal = xToOffsetHz(
        e.clientX - rect.left,
        rect.width,
        sampleRateRef.current,
        viewportRef.current,
      );
      const factor = e.deltaY > 0 ? 1 / 1.18 : 1.18;
      onViewportChange(
        zoomViewportAt(
          viewportRef.current,
          sampleRateRef.current,
          focal,
          factor,
        ),
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const rate = sampleRateRef.current;
      const vp = viewportRef.current;
      const span = viewSpanHz(rate, vp.zoom);
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        const step = e.shiftKey ? span / 20 : span / 80;
        if (e.altKey || vp.zoom <= 1.02) {
          queueLoPan(dir * step);
        } else {
          onViewportChange(panViewport(vp, rate, dir * step));
        }
        return;
      }
      if (e.key === "=" || e.key === "+" || e.key === "-" || e.key === "_") {
        e.preventDefault();
        const factor = e.key === "-" || e.key === "_" ? 1 / 1.25 : 1.25;
        onViewportChange(
          zoomViewportAt(vp, rate, offsetRef.current, factor),
        );
        return;
      }
      if (e.key === "0" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onViewportChange(clampViewport({ zoom: 1, centerOffsetHz: 0 }, rate));
      }
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKeyDown);
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("keydown", onKeyDown);
    };
  }, [canvasRef, onViewportChange, queueLoPan]);

  const cursor = dragging
    ? activeMode === "tune"
      ? "col-resize"
      : "grabbing"
    : viewport.zoom > 1.02
      ? "grab"
      : "crosshair";

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onDoubleClick,
    cursor,
    tabIndex: 0,
  };
}
