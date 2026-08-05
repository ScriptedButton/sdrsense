"use client";

import { useSdrState } from "@/components/sdr/sdr-provider";
import { formatFrequency } from "@/lib/sdr/format";

export function StatusBar() {
  const state = useSdrState();
  const live = state.status === "playing";

  return (
    <footer className="status-bar">
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
      <span>
        Vol{" "}
        <span className="font-mono text-ink">
          {Math.round(state.volume * 100)}%
        </span>
      </span>
      {live && (state.autoSquelch || state.squelch > 0) && (
        <span className={state.squelchOpen ? "text-accent" : undefined}>
          Sq {state.squelchOpen ? "open" : "closed"}
        </span>
      )}
      {state.connection !== "disconnected" && (
        <span className="text-accent">
          {state.connection === "demo" ? "Simulated stick" : "RTL-SDR WebUSB"}
        </span>
      )}
    </footer>
  );
}
