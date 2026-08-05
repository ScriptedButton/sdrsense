"use client";

import { useEffect } from "react";

import { SignalIdRow } from "@/components/sdr/signal-id/signal-id-row";
import { usePointerFreeze } from "@/components/sdr/signal-id/use-pointer-freeze";
import type { IdentifiedSignal } from "@/lib/sdr/signal-id/types";

type SignalIdListProps = {
  signals: IdentifiedSignal[];
  enabled: boolean;
  live: boolean;
  /** Current demodulator offset, used to mark which signal is being heard. */
  offsetHz: number;
  onTune: (signal: IdentifiedSignal) => void;
  onFrozenChange?: (frozen: boolean) => void;
  /** True when filters hid every row but detections still exist. */
  filteredEmpty?: boolean;
};

export function SignalIdList({
  signals,
  enabled,
  live,
  offsetHz,
  onTune,
  onFrozenChange,
  filteredEmpty = false,
}: SignalIdListProps) {
  const { value: displayed, frozen, bind } = usePointerFreeze(signals);

  useEffect(() => {
    onFrozenChange?.(frozen);
  }, [frozen, onFrozenChange]);

  const empty = displayed.length === 0;

  return (
    <div
      className={`signal-list${frozen ? " signal-list-frozen" : ""}`}
      title={
        frozen
          ? "List paused while you aim — move away to resume live updates"
          : undefined
      }
      {...bind}
    >
      {empty ? (
        <p className="signal-list-empty">
          {filteredEmpty
            ? "No signals match these filters."
            : emptyMessage(enabled, live)}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {displayed.map((signal) => (
            <SignalIdRow
              key={signal.id}
              signal={signal}
              active={
                Math.abs(signal.offsetHz - offsetHz) <
                Math.max(signal.bandwidthHz / 2, 1500)
              }
              onTune={onTune}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function emptyMessage(enabled: boolean, live: boolean): string {
  if (!enabled) {
    return "Start a scan to detect every active signal in the tuned window and identify how each one is modulated.";
  }
  if (!live) return "Waiting for RF — connect a stick or start Demo.";
  return "Listening… nothing above the noise floor yet. Try raising sensitivity.";
}
