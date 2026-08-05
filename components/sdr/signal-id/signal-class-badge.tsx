import { classInfo } from "@/lib/sdr/signal-id/labels";
import type { DisplayClass } from "@/lib/sdr/signal-id/types";

type SignalClassBadgeProps = {
  label: DisplayClass;
  /** Dim the badge for classes the operator can safely ignore. */
  muted?: boolean;
};

export function SignalClassBadge({ label, muted = false }: SignalClassBadgeProps) {
  const info = classInfo(label);
  return (
    <span
      className="signal-badge"
      style={{
        color: info.color,
        borderColor: `color-mix(in oklch, ${info.color} 45%, transparent)`,
        background: `color-mix(in oklch, ${info.color} 14%, transparent)`,
        opacity: muted ? 0.65 : 1,
      }}
      title={info.name}
    >
      {info.short}
    </span>
  );
}
