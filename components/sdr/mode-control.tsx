"use client";

import { useRadioController, useSdrState } from "@/components/sdr/sdr-provider";
import type { DemodScheme } from "@/lib/sdr/types";

const SCHEME_META: Record<
  DemodScheme,
  { label: string; hasBw: boolean; hasSq: boolean; hasStereo: boolean }
> = {
  WBFM: { label: "WBFM", hasBw: true, hasSq: false, hasStereo: true },
  NBFM: { label: "NBFM", hasBw: true, hasSq: true, hasStereo: false },
  AM: { label: "AM", hasBw: true, hasSq: true, hasStereo: false },
  USB: { label: "USB", hasBw: true, hasSq: true, hasStereo: false },
  LSB: { label: "LSB", hasBw: true, hasSq: true, hasStereo: false },
  CW: { label: "CW", hasBw: true, hasSq: true, hasStereo: false },
};

export function ModeControl() {
  const controller = useRadioController();
  const state = useSdrState();
  const meta = SCHEME_META[state.scheme];

  return (
    <fieldset className="control-group">
      <legend className="control-label">Mode</legend>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(SCHEME_META) as DemodScheme[]).map((scheme) => (
          <button
            key={scheme}
            type="button"
            className={`mode-chip ${state.scheme === scheme ? "mode-chip-active" : ""}`}
            onClick={() => controller.setScheme(scheme)}
          >
            {SCHEME_META[scheme].label}
          </button>
        ))}
      </div>

      {meta.hasBw && (
        <label className="mt-3 block text-xs text-muted">
          Bandwidth · {state.bandwidthHz.toLocaleString()} Hz
          <input
            type="range"
            className="slider mt-1"
            min={500}
            max={state.scheme === "WBFM" ? 200_000 : 20_000}
            step={100}
            value={state.bandwidthHz}
            onChange={(e) => controller.setBandwidth(Number(e.target.value))}
          />
        </label>
      )}

      {meta.hasSq && (
        <label className="mt-2 block text-xs text-muted">
          Squelch · {state.squelch}
          <input
            type="range"
            className="slider mt-1"
            min={0}
            max={30}
            step={1}
            value={state.squelch}
            onChange={(e) => controller.setSquelch(Number(e.target.value))}
          />
        </label>
      )}

      {meta.hasStereo && (
        <label className="mt-2 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={state.stereo}
            onChange={(e) => controller.setStereo(e.target.checked)}
          />
          Stereo
          {state.stereoActive && (
            <span className="text-xs text-accent">· locked</span>
          )}
        </label>
      )}

      <label className="mt-3 block text-xs text-muted">
        Offset · {state.offsetHz.toLocaleString()} Hz
        <input
          type="range"
          className="slider mt-1"
          min={-Math.floor(state.sampleRate / 2)}
          max={Math.floor(state.sampleRate / 2)}
          step={100}
          value={state.offsetHz}
          onChange={(e) => controller.setOffset(Number(e.target.value))}
        />
      </label>
    </fieldset>
  );
}
