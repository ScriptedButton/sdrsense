"use client";

import { useEffect, useRef } from "react";

import {
  useRadioController,
  useSdrState,
  useTranscriptionState,
} from "@/components/sdr/sdr-provider";

export function TranscriptPanel() {
  const controller = useRadioController();
  const radio = useSdrState();
  const tx = useTranscriptionState();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const live = radio.status === "playing";

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [tx.segments.length]);

  const statusLabel = (() => {
    switch (tx.status) {
      case "loading":
        return `Loading Whisper… ${Math.round(tx.progress * 100)}%`;
      case "listening":
        return "Listening to demod audio";
      case "transcribing":
        return "Transcribing…";
      case "ready":
        return "Model ready";
      case "error":
        return "Error";
      default:
        return "Off";
    }
  })();

  return (
    <fieldset className="control-group">
      <legend className="control-label">Live transcript</legend>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={tx.enabled ? "btn-primary" : "btn-secondary"}
          disabled={tx.status === "loading"}
          onClick={() => void controller.setTranscriptionEnabled(!tx.enabled)}
          title="Transcribe demodulated audio with Whisper in the browser"
        >
          {tx.enabled ? "Stop" : "Transcribe"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={tx.segments.length === 0}
          onClick={() => controller.clearTranscript()}
        >
          Clear
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={tx.segments.length === 0}
          onClick={() => {
            const text = tx.segments.map((s) => s.text).join(" ");
            void navigator.clipboard.writeText(text);
          }}
        >
          Copy
        </button>
      </div>

      <p className="mt-2 text-xs text-muted">
        {statusLabel}
        {!live && tx.enabled ? " · waiting for RF" : null}
      </p>

      {tx.status === "loading" && (
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuenow={Math.round(tx.progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-accent transition-[width] duration-200"
            style={{ width: `${Math.round(tx.progress * 100)}%` }}
          />
        </div>
      )}

      {tx.error && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {tx.error}
        </p>
      )}

      <div
        ref={scrollerRef}
        className="transcript-pane mt-3"
        aria-live="polite"
        aria-relevant="additions"
      >
        {tx.segments.length === 0 ? (
          <p className="text-sm text-muted">
            {tx.enabled
              ? "Speech will appear here every few seconds while audio is present."
              : "Enable transcription to run Whisper on the demodulated audio in your browser."}
          </p>
        ) : (
          <ul className="space-y-2">
            {tx.segments.map((segment) => (
              <li key={segment.id} className="text-sm leading-relaxed text-ink">
                <time
                  className="mr-2 font-mono text-[0.65rem] text-muted"
                  dateTime={new Date(segment.at).toISOString()}
                >
                  {new Date(segment.at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
                {segment.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-2 text-[0.65rem] leading-relaxed text-muted">
        Uses Whisper tiny (English) on-device. First run downloads the model.
        Works on clear voice (AM / NBFM / SSB). Demo mode is tones only — use a
        real voice signal to see text.
      </p>
    </fieldset>
  );
}
