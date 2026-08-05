"use client";

import { ConnectBar } from "@/components/sdr/connect-bar";
import { FrequencyDigitDisplay } from "@/components/sdr/frequency-digit-display";
import { formatFrequencyWith } from "@/lib/sdr/format";
import type { FreqFormatId, FreqTargetId } from "@/lib/sdr/display-settings";

type AppHeaderProps = {
  frequencyHz: number;
  freqFormat: FreqFormatId;
  freqTarget: FreqTargetId;
  onFrequencyChange: (hz: number) => void;
};

/**
 * Brand + hero VFO + connect. Frequency is the product; connect is the gate.
 */
export function AppHeader({
  frequencyHz,
  freqFormat,
  freqTarget,
  onFrequencyChange,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-brand">
        <h1 className="app-header-title">SDRSense</h1>
        <p className="app-header-tagline">RTL-SDR · WebUSB</p>
      </div>

      <div className="app-header-vfo">
        <FrequencyDigitDisplay
          frequencyHz={frequencyHz}
          onChange={onFrequencyChange}
          size="lg"
        />
        <p className="app-header-vfo-meta">
          <span className="font-mono tabular-nums text-accent">
            {formatFrequencyWith(frequencyHz, freqFormat)}
          </span>
          <span className="text-muted">
            · {freqTarget === "tune" ? "listen" : "LO center"}
          </span>
        </p>
      </div>

      <div className="app-header-actions">
        <ConnectBar />
      </div>
    </header>
  );
}
