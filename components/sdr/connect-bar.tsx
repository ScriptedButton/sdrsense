"use client";

import { useEffect, useState } from "react";

import { useRadioController, useSdrState } from "@/components/sdr/sdr-provider";

export function ConnectBar() {
  const controller = useRadioController();
  const state = useSdrState();
  const [mounted, setMounted] = useState(false);
  const playing = state.status === "playing" || state.status === "starting";
  const busy = state.status === "starting" || state.status === "stopping";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keep SSR + first client paint identical; enable WebUSB UI after mount.
  const usbReady = mounted && state.webUsbSupported;
  const showUsbWarning = mounted && !state.webUsbSupported;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!playing ? (
        <>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !usbReady}
            onClick={() => void controller.connectDevice()}
          >
            Connect RTL-SDR
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => void controller.connectDemo()}
          >
            Demo
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => void controller.stop()}
        >
          Disconnect
        </button>
      )}

      <StatusPill state={state.status} connection={state.connection} />

      {showUsbWarning && (
        <span className="text-sm text-warn">
          WebUSB unavailable — use Chrome/Edge, or try Demo
        </span>
      )}
    </div>
  );
}

function StatusPill({
  state,
  connection,
}: {
  state: string;
  connection: string;
}) {
  const label =
    state === "playing"
      ? connection === "demo"
        ? "Demo live"
        : "Receiving"
      : state === "starting"
        ? "Starting…"
        : state === "stopping"
          ? "Stopping…"
          : state === "error"
            ? "Error"
            : "Idle";

  const tone =
    state === "playing"
      ? "bg-accent/15 text-accent"
      : state === "error"
        ? "bg-danger/15 text-danger"
        : "bg-surface-2 text-muted";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      <span
        className={`size-1.5 rounded-full ${
          state === "playing"
            ? "bg-accent animate-pulse"
            : state === "error"
              ? "bg-danger"
              : "bg-muted"
        }`}
        aria-hidden
      />
      {label}
    </span>
  );
}
