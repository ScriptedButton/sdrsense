"use client";

import { useOpenWebRxSession, useSdrState } from "@/components/sdr/sdr-provider";
import { formatFrequency } from "@/lib/sdr/format";
import type { ConnectionMode } from "@/lib/sdr/types";

export function StatusBar() {
  const state = useSdrState();
  const session = useOpenWebRxSession();
  const live = state.status === "playing";
  const source = sourceLabel(state.connection, session?.receiverName ?? null);

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
      {source && <span className="text-accent">{source}</span>}
    </footer>
  );
}

function sourceLabel(
  connection: ConnectionMode,
  receiverName: string | null,
): string | null {
  if (connection === "demo") return "Simulated stick";
  if (connection === "device") return "RTL-SDR WebUSB";
  if (connection === "rtltcp") return "RTL server (IQ)";
  if (connection === "openwebrx") {
    return receiverName ? `OpenWebRX+ · ${receiverName}` : "OpenWebRX+";
  }
  return null;
}
