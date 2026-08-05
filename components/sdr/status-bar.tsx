"use client";

import { useSdrState } from "@/components/sdr/sdr-provider";
import { formatFrequency } from "@/lib/sdr/format";

export function StatusBar() {
  const state = useSdrState();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs text-muted">
      <span>
        Tune{" "}
        <span className="font-mono text-ink">
          {formatFrequency(state.frequencyHz + state.offsetHz)}
        </span>
      </span>
      <span>
        Center{" "}
        <span className="font-mono text-ink">
          {formatFrequency(state.frequencyHz)}
        </span>
      </span>
      <span>
        Mode <span className="font-mono text-ink">{state.scheme}</span>
      </span>
      <span>
        Rate{" "}
        <span className="font-mono text-ink">
          {(state.sampleRate / 1e6).toFixed(3)} Msps
        </span>
      </span>
      {state.connection !== "disconnected" && (
        <span className="text-accent">
          {state.connection === "demo" ? "Simulated stick" : "RTL-SDR WebUSB"}
        </span>
      )}
    </div>
  );
}
