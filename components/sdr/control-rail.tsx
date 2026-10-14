"use client";

import { useMemo, useState } from "react";

import { AudioGainControl } from "@/components/sdr/audio-gain-control";
import {
  CallsignLookupNavProvider,
} from "@/components/sdr/callsign/callsign-lookup-nav";
import {
  CallsignLookupPanel,
  type CallsignLookupSeed,
} from "@/components/sdr/callsign/callsign-lookup-panel";
import { FrequencyControl } from "@/components/sdr/frequency-control";
import { FreqLookupPanel } from "@/components/sdr/freq-lookup/freq-lookup-panel";
import { FskPanel } from "@/components/sdr/fsk/fsk-panel";
import { Ft8Panel } from "@/components/sdr/ft8/ft8-panel";
import { GmrsChannelPresets } from "@/components/sdr/gmrs-channel-presets";
import { ModeControl } from "@/components/sdr/mode-control";
import { MorsePanel } from "@/components/sdr/morse/morse-panel";
import { P25Panel } from "@/components/sdr/p25/p25-panel";
import { RailTabs } from "@/components/sdr/rail-tabs";
import { SampleRateControl } from "@/components/sdr/sample-rate-control";
import { ScannerPanel } from "@/components/sdr/scanner/scanner-panel";
import {
  useFskState,
  useFt8State,
  useMorseState,
  useP25State,
  useScannerState,
  useSdrState,
  useSignalIdState,
  useTranscriptionState,
  useWefaxState,
} from "@/components/sdr/sdr-provider";
import { ShortwaveExplorer } from "@/components/sdr/shortwave/shortwave-explorer";
import { SignalIdPanel } from "@/components/sdr/signal-id/signal-id-panel";
import { TranscriptPanel } from "@/components/sdr/transcript-panel";
import { WefaxPanel } from "@/components/sdr/wefax/wefax-panel";
import { normalizeCallsign } from "@/lib/sdr/callsign/normalize";
import type { FreqFormatId, FreqTargetId } from "@/lib/sdr/display-settings";

type ControlRailProps = {
  freqTarget: FreqTargetId;
  freqFormat: FreqFormatId;
  onFreqTargetChange: (id: FreqTargetId) => void;
  onFreqFormatChange: (id: FreqFormatId) => void;
};

type MainTab = "radio" | "decode" | "identify";
type DecodeTab = "morse" | "fsk" | "ft8" | "wefax" | "trunk" | "speech";
type IdentifyTab = "signals" | "frequency" | "callsign";

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
  const wefax = useWefaxState();
  const p25 = useP25State();
  const tx = useTranscriptionState();
  const scan = useSignalIdState();
  const scanner = useScannerState();

  const [mainTab, setMainTab] = useState<MainTab>("radio");
  const [decodeTab, setDecodeTab] = useState<DecodeTab>("morse");
  const [identifyTab, setIdentifyTab] = useState<IdentifyTab>("signals");
  const [lookupSeed, setLookupSeed] = useState<CallsignLookupSeed | null>(
    null,
  );

  const decodeActive =
    morse.enabled ||
    fsk.enabled ||
    ft8.enabled ||
    wefax.enabled ||
    p25.enabled ||
    tx.enabled;

  const scannerActive =
    scanner.status === "scanning" ||
    scanner.status === "held" ||
    scanner.status === "paused";

  const callsignNav = useMemo(
    () => ({
      openCallsignLookup: (callsign: string) => {
        const call = normalizeCallsign(callsign) ?? callsign.trim().toUpperCase();
        setMainTab("identify");
        setIdentifyTab("callsign");
        setLookupSeed({ callsign: call, nonce: Date.now() });
      },
    }),
    [],
  );

  return (
    <CallsignLookupNavProvider value={callsignNav}>
      <aside className="control-rail">
        <RailTabs
          label="Control panels"
          value={mainTab}
          onChange={setMainTab}
          tabs={[
            { id: "radio", label: "Radio", badge: scannerActive },
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
              <GmrsChannelPresets />
              <ScannerPanel />
              <ShortwaveExplorer />
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
                  { id: "wefax", label: "Fax", badge: wefax.enabled },
                  {
                    id: "trunk",
                    label: "Trunk",
                    badge: p25.enabled || p25.status === "trunking",
                  },
                  { id: "speech", label: "Speech", badge: tx.enabled },
                ]}
              />
              {decodeTab === "morse" && <MorsePanel />}
              {decodeTab === "fsk" && <FskPanel />}
              {decodeTab === "ft8" && <Ft8Panel />}
              {decodeTab === "wefax" && <WefaxPanel />}
              {decodeTab === "trunk" && <P25Panel />}
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
              <RailTabs
                label="Identify tools"
                size="sm"
                value={identifyTab}
                onChange={setIdentifyTab}
                tabs={[
                  {
                    id: "signals",
                    label: "Signals",
                    badge:
                      scan.signals.length > 0 ? scan.signals.length : false,
                  },
                  { id: "frequency", label: "Frequency" },
                  { id: "callsign", label: "Callsign" },
                ]}
              />
              {identifyTab === "signals" && <SignalIdPanel />}
              {identifyTab === "frequency" && <FreqLookupPanel />}
              {identifyTab === "callsign" && (
                <CallsignLookupPanel seed={lookupSeed} />
              )}
            </div>
          )}
        </div>
      </aside>
    </CallsignLookupNavProvider>
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
        <li>Or a local OpenWebRX+ server, usually localhost:8073</li>
        {!supported && (
          <li className="text-warn">
            This browser has no WebUSB — Demo still works
          </li>
        )}
      </ul>
    </div>
  );
}
