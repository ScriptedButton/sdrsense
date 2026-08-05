"use client";

import { useRadioController, useSdrState } from "@/components/sdr/sdr-provider";

export function AudioGainControl() {
  const controller = useRadioController();
  const state = useSdrState();

  return (
    <fieldset className="control-group">
      <legend className="control-label">Audio & RF</legend>

      <label className="block text-xs text-muted">
        Volume · {Math.round(state.volume * 100)}%
        <input
          type="range"
          className="slider mt-1"
          min={0}
          max={100}
          value={Math.round(state.volume * 100)}
          onChange={(e) => controller.setVolume(Number(e.target.value) / 100)}
        />
      </label>

      <label className="mt-3 flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={state.autoGain}
          onChange={(e) => void controller.setAutoGain(e.target.checked)}
        />
        Automatic gain
      </label>

      <label className="mt-2 block text-xs text-muted">
        Gain · {state.autoGain ? "AGC" : `${state.gainDb} dB`}
        <input
          type="range"
          className="slider mt-1"
          min={0}
          max={50}
          step={0.5}
          disabled={state.autoGain}
          value={state.gainDb}
          onChange={(e) => void controller.setGain(Number(e.target.value))}
        />
      </label>

      <label className="mt-3 block text-xs text-muted">
        PPM correction · {state.ppm}
        <input
          type="range"
          className="slider mt-1"
          min={-100}
          max={100}
          step={1}
          value={state.ppm}
          onChange={(e) => void controller.setPpm(Number(e.target.value))}
        />
      </label>

      <label className="mt-3 flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={state.biasTee}
          onChange={(e) => void controller.setBiasTee(e.target.checked)}
        />
        Bias-T
      </label>
    </fieldset>
  );
}
