"use client";

import { useCallback, useMemo, useState } from "react";

import {
  useRadioController,
  useSdrState,
  useSignalIdState,
} from "@/components/sdr/sdr-provider";
import { SignalIdControls } from "@/components/sdr/signal-id/signal-id-controls";
import { SignalIdFiltersBar } from "@/components/sdr/signal-id/signal-id-filters";
import { SignalIdList } from "@/components/sdr/signal-id/signal-id-list";
import { MODEL_ACCURACY } from "@/lib/sdr/signal-id/classifier";
import { CATALOG_COUNT } from "@/lib/sdr/signal-id/catalog";
import {
  applySignalIdFilters,
  DEFAULT_SIGNAL_ID_FILTERS,
  type SignalIdFilters,
} from "@/lib/sdr/signal-id/filters";
import type { SignalIdSensitivity } from "@/lib/sdr/signal-id/engine";
import type { IdentifiedSignal } from "@/lib/sdr/signal-id/types";

export function SignalIdPanel() {
  const controller = useRadioController();
  const radio = useSdrState();
  const scan = useSignalIdState();
  const [sensitivity, setSensitivity] = useState<SignalIdSensitivity>(() =>
    controller.getSignalIdSensitivity(),
  );
  const [listFrozen, setListFrozen] = useState(false);
  const [filters, setFilters] = useState<SignalIdFilters>(
    DEFAULT_SIGNAL_ID_FILTERS,
  );
  const live = radio.status === "playing";

  const filtered = useMemo(
    () => applySignalIdFilters(scan.signals, filters),
    [scan.signals, filters],
  );

  const onToggle = useCallback(() => {
    controller.setSignalIdEnabled(!scan.enabled);
  }, [controller, scan.enabled]);

  const onSensitivityChange = useCallback(
    (value: SignalIdSensitivity) => {
      setSensitivity(value);
      controller.setSignalIdSensitivity(value);
    },
    [controller],
  );

  const onTune = useCallback(
    (signal: IdentifiedSignal) => {
      controller.tuneToSignal(signal.offsetHz, signal.scheme);
    },
    [controller],
  );

  return (
    <fieldset className="control-group">
      <legend className="control-label">Signal identification</legend>

      <SignalIdControls
        enabled={scan.enabled}
        sensitivity={sensitivity}
        onToggle={onToggle}
        onSensitivityChange={onSensitivityChange}
      />

      <p className="mt-2 text-xs text-muted" aria-live="polite">
        {statusLabel(
          scan.enabled,
          live,
          filtered.length,
          scan.signals.length,
          scan.noiseFloorDb,
          listFrozen,
        )}
      </p>

      {scan.error && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {scan.error}
        </p>
      )}

      <div className="mt-2">
        <SignalIdFiltersBar
          filters={filters}
          onChange={setFilters}
          matchedCount={filtered.length}
          totalCount={scan.signals.length}
        />
      </div>

      <div className="mt-2">
        <SignalIdList
          signals={filtered}
          enabled={scan.enabled}
          live={live}
          offsetHz={radio.offsetHz}
          onTune={onTune}
          onFrozenChange={setListFrozen}
          filteredEmpty={scan.signals.length > 0 && filtered.length === 0}
        />
      </div>

      <p className="mt-2 text-[0.65rem] leading-relaxed text-muted">
        Finds every emission in the tuned window, classifies its modulation
        with an on-device neural net ({Math.round(MODEL_ACCURACY * 100)}%
        held-out), then matches frequency, bandwidth, and mode against a{" "}
        {CATALOG_COUNT.toLocaleString()}-entry SigID wiki catalog. Select a
        signal to tune it and switch the demodulator to match.
      </p>
    </fieldset>
  );
}

function statusLabel(
  enabled: boolean,
  live: boolean,
  matched: number,
  total: number,
  noiseFloorDb: number,
  listFrozen: boolean,
): string {
  if (!enabled) return "Off";
  if (!live) return "Armed · waiting for RF";
  if (total === 0) return "Scanning…";
  const floor = Number.isFinite(noiseFloorDb) ? Math.round(noiseFloorDb) : null;
  const countLabel =
    matched === total
      ? `${total} ${total === 1 ? "signal" : "signals"}`
      : `${matched} of ${total}`;
  const base =
    floor === null ? countLabel : `${countLabel} · noise floor ${floor} dB`;
  return listFrozen ? `${base} · paused` : base;
}
