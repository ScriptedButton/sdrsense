"use client";

import { formatBandwidth } from "@/lib/sdr/format";
import {
  MIN_ZOOM,
  type SpectrumViewport,
  viewSpanHz,
} from "@/lib/sdr/spectrum-viewport";

type SpectrumNavChromeProps = {
  sampleRate: number;
  viewport: SpectrumViewport;
  onResetZoom: () => void;
};

export function SpectrumNavChrome({
  sampleRate,
  viewport,
  onResetZoom,
}: SpectrumNavChromeProps) {
  const span = viewSpanHz(sampleRate, viewport.zoom);
  const zoomed = viewport.zoom > MIN_ZOOM + 0.02;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-1.5">
      <p className="text-xs text-muted">
        Click tune · drag pan · scroll zoom · double-click center
        <span className="hidden sm:inline"> · ←→ pan · +/− zoom</span>
      </p>
      <div className="flex items-center gap-2">
        <p className="font-mono text-[0.7rem] tabular-nums text-muted">
          Span {formatBandwidth(span)}
          {zoomed ? ` · ${viewport.zoom.toFixed(1)}×` : ""}
        </p>
        {zoomed && (
          <button
            type="button"
            className="rounded border border-line bg-surface-2 px-2 py-0.5 text-[0.65rem] font-medium text-ink transition-[border-color,background] duration-150 hover:border-[oklch(0.40_0.02_355)]"
            onClick={onResetZoom}
          >
            Reset zoom
          </button>
        )}
      </div>
    </div>
  );
}
