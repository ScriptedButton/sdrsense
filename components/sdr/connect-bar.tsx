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
    <div className="connect-bar">
      {!playing ? (
        <>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !usbReady}
            onClick={() => void controller.connectDevice()}
          >
            Connect
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
          Stop
        </button>
      )}

      <StatusPill state={state.status} connection={state.connection} />

      {showUsbWarning && (
        <span className="connect-bar-warn">
          No WebUSB — try Demo
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
      ? "status-pill-live"
      : state === "error"
        ? "status-pill-error"
        : "status-pill-idle";

  return (
    <span className={`status-pill ${tone}`}>
      <span
        className={`status-pill-dot ${
          state === "playing"
            ? "status-pill-dot-live"
            : state === "error"
              ? "status-pill-dot-error"
              : ""
        }`}
        aria-hidden
      />
      {label}
    </span>
  );
}
