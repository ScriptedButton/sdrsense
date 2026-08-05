"use client";

import { useRadioController, useSdrState } from "@/components/sdr/sdr-provider";
import { BAND_PRESETS } from "@/lib/sdr/format";

export function BandPresets() {
  const controller = useRadioController();
  const state = useSdrState();

  return (
    <fieldset className="control-group">
      <legend className="control-label">Presets</legend>
      <div className="flex flex-wrap gap-1.5">
        {BAND_PRESETS.map((preset) => {
          const active =
            Math.abs(state.frequencyHz - preset.frequencyHz) < 1_000 &&
            state.scheme === preset.scheme;
          return (
            <button
              key={preset.id}
              type="button"
              className={`preset-chip ${active ? "preset-chip-active" : ""}`}
              onClick={() => {
                controller.setScheme(preset.scheme);
                void controller.setFrequency(preset.frequencyHz);
                controller.setOffset(0);
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
