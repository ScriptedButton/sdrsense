"use client";

import { useRadioController, useSdrState } from "@/components/sdr/sdr-provider";
import { SAMPLE_RATES } from "@/lib/sdr/types";

export function SampleRateControl() {
  const controller = useRadioController();
  const state = useSdrState();
  const busy = state.status === "starting" || state.status === "stopping";
  const remote = state.connection === "openwebrx";

  if (remote) {
    return (
      <fieldset className="control-group">
        <legend className="control-label">Spectrum width</legend>
        <p className="text-[0.7rem] leading-snug text-muted">
          Set by the OpenWebRX+ profile ·{" "}
          <span className="font-mono text-ink">
            {(state.sampleRate / 1e6).toFixed(3)} MHz
          </span>
          . Switch profile to change the window.
        </p>
      </fieldset>
    );
  }

  return (
    <fieldset className="control-group">
      <legend className="control-label">Spectrum width</legend>
      <div className="flex flex-wrap gap-1">
        {SAMPLE_RATES.map((option) => {
          const active = Math.abs(state.sampleRate - option.hz) < 1_000;
          return (
            <button
              key={option.hz}
              type="button"
              className={`mode-chip ${active ? "mode-chip-active" : ""}`}
              disabled={busy}
              title={
                option.hint
                  ? `${option.label} span · ${option.hint}`
                  : `${option.label} capture span`
              }
              aria-pressed={active}
              onClick={() => void controller.setSampleRate(option.hz)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[0.7rem] leading-snug text-muted">
        Capture bandwidth around the LO. Higher rates see more of the band;
        lower rates resolve finer detail. Changing rate briefly restarts the
        stick.
      </p>
    </fieldset>
  );
}
