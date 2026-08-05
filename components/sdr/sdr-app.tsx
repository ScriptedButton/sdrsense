"use client";

import { useCallback, useState } from "react";

import { AudioGainControl } from "@/components/sdr/audio-gain-control";
import { BandPresets } from "@/components/sdr/band-presets";
import { ConnectBar } from "@/components/sdr/connect-bar";
import { DisplayModeToggle } from "@/components/sdr/display-mode-toggle";
import { FrequencyControl } from "@/components/sdr/frequency-control";
import { ModeControl } from "@/components/sdr/mode-control";
import { useRadioController, useSdrState } from "@/components/sdr/sdr-provider";
import { Spectrometer3D } from "@/components/sdr/spectrometer-3d";
import { SpectrumScope } from "@/components/sdr/spectrum-scope";
import { StatusBar } from "@/components/sdr/status-bar";
import { TranscriptPanel } from "@/components/sdr/transcript-panel";
import { WaterfallDisplay } from "@/components/sdr/waterfall-display";
import type { DisplayMode } from "@/lib/sdr/display-mode";
import { formatFrequency } from "@/lib/sdr/format";

export function SdrApp() {
  const controller = useRadioController();
  const state = useSdrState();
  const live = state.status === "playing";
  const [displayMode, setDisplayMode] = useState<DisplayMode>("scope");

  const onTuneOffset = useCallback(
    (offsetHz: number) => {
      controller.setOffset(offsetHz);
    },
    [controller],
  );

  return (
    <div className="flex min-h-full flex-1 flex-col bg-bg text-ink">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            SDRSense
          </h1>
          <p className="hidden text-sm text-muted sm:block">
            RTL-SDR v4 · WebUSB
          </p>
        </div>
        <ConnectBar />
      </header>

      {state.error && (
        <div
          className="border-b border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger sm:px-6"
          role="alert"
        >
          {state.error}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex min-h-[28rem] flex-col border-b border-line lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-ink">
                {displayMode === "spectrometer3d" ? "3D Spectrometer" : "Spectrum"}
              </h2>
              <DisplayModeToggle
                value={displayMode}
                onChange={setDisplayMode}
              />
            </div>
            <p className="font-mono text-sm text-accent">
              {formatFrequency(state.frequencyHz + state.offsetHz)}
            </p>
          </div>

          {displayMode === "scope" ? (
            <ScopeLayout
              live={live}
              sampleRate={state.sampleRate}
              frequencyHz={state.frequencyHz}
              offsetHz={state.offsetHz}
              bandwidthHz={state.bandwidthHz}
              onTuneOffset={onTuneOffset}
            />
          ) : (
            <SpectrometerLayout
              live={live}
              sampleRate={state.sampleRate}
              offsetHz={state.offsetHz}
              bandwidthHz={state.bandwidthHz}
              onTuneOffset={onTuneOffset}
            />
          )}
        </section>

        <aside className="flex flex-col gap-4 overflow-y-auto p-4 sm:p-5">
          <FrequencyControl />
          <ModeControl />
          <AudioGainControl />
          <TranscriptPanel />
          <BandPresets />
          <HelpCard supported={state.webUsbSupported} />
        </aside>
      </div>

      <StatusBar />
    </div>
  );
}

type ScopeLayoutProps = {
  live: boolean;
  sampleRate: number;
  frequencyHz: number;
  offsetHz: number;
  bandwidthHz: number;
  onTuneOffset: (offsetHz: number) => void;
};

function ScopeLayout({
  live,
  sampleRate,
  frequencyHz,
  offsetHz,
  bandwidthHz,
  onTuneOffset,
}: ScopeLayoutProps) {
  return (
    <>
      <div className="relative min-h-48 flex-1 bg-canvas">
        {live ? (
          <SpectrumScope
            sampleRate={sampleRate}
            frequencyHz={frequencyHz}
            offsetHz={offsetHz}
            bandwidthHz={bandwidthHz}
            onTuneOffset={onTuneOffset}
          />
        ) : (
          <EmptyDisplay
            title="Waiting for RF"
            body="Connect an RTL-SDR stick or start Demo to see the spectrum."
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-y border-line px-4 py-2">
        <h2 className="text-sm font-medium text-ink">Waterfall</h2>
        <p className="text-xs text-muted">Newest at top</p>
      </div>

      <div className="relative min-h-52 flex-[1.15] bg-canvas">
        {live ? (
          <WaterfallDisplay
            sampleRate={sampleRate}
            offsetHz={offsetHz}
            bandwidthHz={bandwidthHz}
          />
        ) : (
          <EmptyDisplay
            title="No waterfall yet"
            body="Signal history appears here once reception starts."
          />
        )}
      </div>
    </>
  );
}

type SpectrometerLayoutProps = {
  live: boolean;
  sampleRate: number;
  offsetHz: number;
  bandwidthHz: number;
  onTuneOffset: (offsetHz: number) => void;
};

function SpectrometerLayout({
  live,
  sampleRate,
  offsetHz,
  bandwidthHz,
  onTuneOffset,
}: SpectrometerLayoutProps) {
  return (
    <div className="relative flex min-h-[32rem] flex-1 flex-col bg-canvas">
      {live ? (
        <>
          <div className="relative min-h-0 flex-1">
            <Spectrometer3D
              sampleRate={sampleRate}
              offsetHz={offsetHz}
              bandwidthHz={bandwidthHz}
              onTuneOffset={onTuneOffset}
            />
          </div>
          <p className="border-t border-line px-4 py-1.5 text-xs text-muted">
            Drag to orbit · scroll to zoom · click to tune · X frequency · Z time · Y
            power
          </p>
        </>
      ) : (
        <EmptyDisplay
          title="Waiting for RF"
          body="Connect an RTL-SDR stick or start Demo to explore the 3D spectrometer."
        />
      )}
    </div>
  );
}

function EmptyDisplay({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-sm text-sm text-muted">{body}</p>
    </div>
  );
}

function HelpCard({ supported }: { supported: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-muted">
      <p className="mb-1 font-medium text-ink">Setup</p>
      <ul className="list-inside list-disc space-y-1">
        <li>Chrome, Edge, or Opera on desktop/Android</li>
        <li>Serve over HTTPS or localhost</li>
        <li>RTL-SDR v4 (R828D) or other RTL2832U sticks</li>
        {!supported && (
          <li className="text-warn">This browser has no WebUSB — Demo still works</li>
        )}
      </ul>
    </div>
  );
}
