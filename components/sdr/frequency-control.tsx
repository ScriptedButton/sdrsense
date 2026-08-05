"use client";

import { useEffect, useState } from "react";

import { useRadioController, useSdrState } from "@/components/sdr/sdr-provider";
import { formatFrequencyCompact, parseFrequencyInput } from "@/lib/sdr/format";

const STEPS = [
  { label: "1 Hz", hz: 1 },
  { label: "10 Hz", hz: 10 },
  { label: "100 Hz", hz: 100 },
  { label: "1 kHz", hz: 1_000 },
  { label: "5 kHz", hz: 5_000 },
  { label: "25 kHz", hz: 25_000 },
  { label: "100 kHz", hz: 100_000 },
  { label: "1 MHz", hz: 1_000_000 },
] as const;

export function FrequencyControl() {
  const controller = useRadioController();
  const state = useSdrState();
  const [draft, setDraft] = useState(formatFrequencyCompact(state.frequencyHz));
  const [unit, setUnit] = useState<"MHz" | "kHz" | "Hz">("MHz");
  const [stepHz, setStepHz] = useState(100_000);

  useEffect(() => {
    setDraft(formatFrequencyCompact(state.frequencyHz));
    if (state.frequencyHz >= 1e6) setUnit("MHz");
    else if (state.frequencyHz >= 1e3) setUnit("kHz");
    else setUnit("Hz");
  }, [state.frequencyHz]);

  const commit = () => {
    const hz = parseFrequencyInput(draft, unit);
    if (hz == null) {
      setDraft(formatFrequencyCompact(state.frequencyHz));
      return;
    }
    void controller.setFrequency(hz);
  };

  return (
    <fieldset className="control-group">
      <legend className="control-label">Frequency</legend>
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          className="btn-icon"
          aria-label={`Decrease by ${stepHz} Hz`}
          onClick={() => void controller.nudgeFrequency(-stepHz)}
        >
          −
        </button>
        <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-md border border-line bg-surface-2 focus-within:border-primary">
          <input
            className="freq-input min-w-0 flex-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            inputMode="decimal"
            aria-label="Center frequency"
          />
          <select
            className="border-l border-line bg-transparent px-2 text-sm text-muted outline-none"
            value={unit}
            onChange={(e) => setUnit(e.target.value as "MHz" | "kHz" | "Hz")}
            aria-label="Frequency unit"
          >
            <option value="MHz">MHz</option>
            <option value="kHz">kHz</option>
            <option value="Hz">Hz</option>
          </select>
        </div>
        <button
          type="button"
          className="btn-icon"
          aria-label={`Increase by ${stepHz} Hz`}
          onClick={() => void controller.nudgeFrequency(stepHz)}
        >
          +
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-muted">
        Step
        <select
          className="input-sm flex-1"
          value={stepHz}
          onChange={(e) => setStepHz(Number(e.target.value))}
        >
          {STEPS.map((s) => (
            <option key={s.hz} value={s.hz}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
