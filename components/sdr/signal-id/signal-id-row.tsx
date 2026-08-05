import { ConfidenceMeter } from "@/components/sdr/signal-id/confidence-meter";
import { SignalClassBadge } from "@/components/sdr/signal-id/signal-class-badge";
import { SignalIdentityHint } from "@/components/sdr/signal-id/signal-identity-hint";
import { formatBandwidth, formatFrequency } from "@/lib/sdr/format";
import { classInfo } from "@/lib/sdr/signal-id/labels";
import type { IdentifiedSignal } from "@/lib/sdr/signal-id/types";

type SignalIdRowProps = {
  signal: IdentifiedSignal;
  active: boolean;
  onTune: (signal: IdentifiedSignal) => void;
};

export function SignalIdRow({ signal, active, onTune }: SignalIdRowProps) {
  const info = classInfo(signal.label);
  const noise = signal.label === "NOISE";
  const snr = Math.round(signal.snrDb);
  const identity = signal.identities[0];

  const description = [
    identity ? `${identity.name} (${info.name})` : info.name,
    `at ${formatFrequency(signal.frequencyHz)}`,
    `${formatBandwidth(signal.bandwidthHz)} wide`,
    `${snr} decibels above noise`,
    `${Math.round(signal.confidence * 100)} percent confidence.`,
    info.scheme ? `Tune and switch to ${info.scheme}.` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <li>
      <button
        type="button"
        className={`signal-row${active ? " signal-row-active" : ""}`}
        onClick={() => onTune(signal)}
        aria-label={description}
        title={identity?.description ?? info.hint}
      >
        <span className="flex items-center justify-between gap-2">
          <SignalClassBadge label={signal.label} muted={noise} />
          <span className="truncate font-mono text-sm tabular-nums text-ink">
            {formatFrequency(signal.frequencyHz)}
          </span>
        </span>

        <span className="signal-row-identity">
          {identity ? <SignalIdentityHint identity={identity} /> : null}
        </span>

        <span className="mt-1.5 flex items-center justify-between gap-2">
          <span className="font-mono text-[0.65rem] tabular-nums text-muted">
            {formatBandwidth(signal.bandwidthHz)} · {snr} dB
          </span>
          <ConfidenceMeter value={signal.confidence} color={info.color} />
        </span>
      </button>
    </li>
  );
}
