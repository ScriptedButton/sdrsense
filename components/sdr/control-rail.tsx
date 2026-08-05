"use client";

import { useState } from "react";

import { AudioGainControl } from "@/components/sdr/audio-gain-control";
import { FrequencyControl } from "@/components/sdr/frequency-control";
import { FskPanel } from "@/components/sdr/fsk/fsk-panel";
import { Ft8Panel } from "@/components/sdr/ft8/ft8-panel";
import { ModeControl } from "@/components/sdr/mode-control";
import { MorsePanel } from "@/components/sdr/morse/morse-panel";
import { RailTabs } from "@/components/sdr/rail-tabs";
import { SampleRateControl } from "@/components/sdr/sample-rate-control";
import {
  useFskState,
  useFt8State,
  useMorseState,
  useSdrState,
  useSignalIdState,
  useTranscriptionState,
} from "@/components/sdr/sdr-provider";
import { SignalIdPanel } from "@/components/sdr/signal-id/signal-id-panel";
import { TranscriptPanel } from "@/components/sdr/transcript-panel";
import type { FreqFormatId, FreqTargetId } from "@/lib/sdr/display-settings";

type ControlRailProps = {
  freqTarget: FreqTargetId;
  freqFormat: FreqFormatId;
  onFreqTargetChange: (id: FreqTargetId) => void;
  onFreqFormatChange: (id: FreqFormatId) => void;
};

type MainTab = "radio" | "decode" | "identify";
type DecodeTab = "morse" | "fsk" | "ft8" | "speech";

/**
 * Tabbed side rail: Radio (daily tune/audio), Decode (progressive), Identify.
 * Replaces the old all-panels-stacked scroll that buried common ops.
 */
export function ControlRail({
  freqTarget,
  freqFormat,
  onFreqTargetChange,
  onFreqFormatChange,
}: ControlRailProps) {
  const state = useSdrState();
  const morse = useMorseState();
  const fsk = useFskState();
  const ft8 = useFt8State();
  const tx = useTranscriptionState();
  const scan = useSignalIdState();

  const [mainTab, setMainTab] = useState<MainTab>("radio");
  const [decodeTab, setDecodeTab] = useState<DecodeTab>("morse");

  const decodeActive =
    morse.enabled || fsk.enabled || ft8.enabled || tx.enabled;

  return (
    <aside className="control-rail">
      <RailTabs
        label="Control panels"
        value={mainTab}
        onChange={setMainTab}
        tabs={[
          { id: "radio", label: "Radio" },
          {
            id: "decode",
            label: "Decode",
            badge: decodeActive,
          },
          {
            id: "identify",
            label: "Identify",
            badge: scan.signals.length > 0 ? scan.signals.length : false,
          },
        ]}
      />

      <div className="control-rail-body">
        {mainTab === "radio" && (
          <div
            role="tabpanel"
            id="rail-panel-radio"
            aria-labelledby="rail-tab-radio"
            className="control-rail-stack"
          >
            <FrequencyControl
              freqTarget={freqTarget}
              freqFormat={freqFormat}
              onFreqTargetChange={onFreqTargetChange}
              onFreqFormatChange={onFreqFormatChange}
              showDigits={false}
            />
            <ModeControl showSchemes={false} />
            <SampleRateControl />
            <AudioGainControl />
            <HelpCard supported={state.webUsbSupported} />
          </div>
        )}

        {mainTab === "decode" && (
          <div
            role="tabpanel"
            id="rail-panel-decode"
            aria-labelledby="rail-tab-decode"
            className="control-rail-stack"
          >
            <RailTabs
              label="Decoder"
              size="sm"
              value={decodeTab}
              onChange={setDecodeTab}
              tabs={[
                { id: "morse", label: "Morse", badge: morse.enabled },
                { id: "fsk", label: "FSK", badge: fsk.enabled },
                { id: "ft8", label: "FT8", badge: ft8.enabled },
                { id: "speech", label: "Speech", badge: tx.enabled },
              ]}
            />
            {decodeTab === "morse" && <MorsePanel />}
            {decodeTab === "fsk" && <FskPanel />}
            {decodeTab === "ft8" && <Ft8Panel />}
            {decodeTab === "speech" && <TranscriptPanel />}
          </div>
        )}

        {mainTab === "identify" && (
          <div
            role="tabpanel"
            id="rail-panel-identify"
            aria-labelledby="rail-tab-identify"
            className="control-rail-stack"
          >
            <SignalIdPanel />
          </div>
        )}
      </div>
    </aside>
  );
}

function HelpCard({ supported }: { supported: boolean }) {
  return (
    <div className="help-card">
      <p className="help-card-title">Setup</p>
      <ul className="help-card-list">
        <li>Chrome, Edge, or Opera on desktop/Android</li>
        <li>Serve over HTTPS or localhost</li>
        <li>RTL-SDR v4 (R828D) or other RTL2832U sticks</li>
        {!supported && (
          <li className="text-warn">
            This browser has no WebUSB — Demo still works
          </li>
        )}
      </ul>
    </div>
  );
}
