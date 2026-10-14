"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppHeader } from "@/components/sdr/app-header";
import { ControlRail } from "@/components/sdr/control-rail";
import { DisplayModeToggle } from "@/components/sdr/display-mode-toggle";
import { NoiseFilterControl } from "@/components/sdr/noise-filter-control";
import { OpenWebRxConnect } from "@/components/sdr/openwebrx/openwebrx-connect";
import { PrimaryToolbar } from "@/components/sdr/primary-toolbar";
import {
  useRadioController,
  useSdrState,
  useSignalIdState,
} from "@/components/sdr/sdr-provider";
import { Spectrometer3D } from "@/components/sdr/spectrometer-3d";
import { SpectrumNavChrome } from "@/components/sdr/spectrum-nav-chrome";
import { SpectrumScope } from "@/components/sdr/spectrum-scope";
import { StatusBar } from "@/components/sdr/status-bar";
import { WaterfallControls } from "@/components/sdr/waterfall-controls";
import { WaterfallDisplay } from "@/components/sdr/waterfall-display";
import type { DisplayMode } from "@/lib/sdr/display-mode";
import {
  DEFAULT_DISPLAY_SETTINGS,
  loadDisplaySettings,
  patchDisplaySettings,
  type DisplaySettings,
  type NoiseFilterId,
} from "@/lib/sdr/display-settings";
import { classInfo } from "@/lib/sdr/signal-id/labels";
import type { SignalMarker } from "@/lib/sdr/signal-id/scope-overlay";
import {
  clampViewport,
  DEFAULT_VIEWPORT,
  type SpectrumViewport,
} from "@/lib/sdr/spectrum-viewport";

export function SdrApp() {
  const controller = useRadioController();
  const state = useSdrState();
  const scan = useSignalIdState();
  const live = state.status === "playing";
  const [displayMode, setDisplayMode] = useState<DisplayMode>("scope");
  const [settings, setSettings] = useState<DisplaySettings>(
    DEFAULT_DISPLAY_SETTINGS,
  );

  useEffect(() => {
    setSettings(loadDisplaySettings());
  }, []);

  const updateSettings = useCallback((patch: Partial<DisplaySettings>) => {
    setSettings((prev) => patchDisplaySettings(prev, patch));
  }, []);

  const markers = useMemo<SignalMarker[]>(
    () =>
      scan.signals.map((signal) => {
        const info = classInfo(signal.label);
        const identity = signal.identities[0];
        const shortName = identity
          ? identity.name.length > 18
            ? `${identity.name.slice(0, 16)}…`
            : identity.name
          : info.short;
        return {
          id: signal.id,
          offsetHz: signal.offsetHz,
          bandwidthHz: signal.bandwidthHz,
          label: shortName,
          color: info.color,
        };
      }),
    [scan.signals],
  );

  const onTuneOffset = useCallback(
    (offsetHz: number) => {
      controller.setOffset(offsetHz);
    },
    [controller],
  );

  const onCenterOnOffset = useCallback(
    (offsetHz: number) => {
      controller.centerOnHz(state.frequencyHz + offsetHz);
    },
    [controller, state.frequencyHz],
  );

  const onPanLo = useCallback(
    (deltaHz: number) => {
      void controller.panFrequency(deltaHz);
    },
    [controller],
  );

  const headerHz =
    settings.freqTarget === "tune"
      ? state.frequencyHz + state.offsetHz
      : state.frequencyHz;

  const onHeaderFreqChange = useCallback(
    (hz: number) => {
      if (settings.freqTarget === "tune") {
        controller.tuneToHz(hz);
      } else {
        void controller.setFrequency(hz);
      }
    },
    [controller, settings.freqTarget],
  );

  return (
    <div className="sdr-shell">
      <AppHeader
        frequencyHz={headerHz}
        freqFormat={settings.freqFormat}
        freqTarget={settings.freqTarget}
        onFrequencyChange={onHeaderFreqChange}
      />

      {state.error && (
        <div className="sdr-error" role="alert">
          {state.error}
        </div>
      )}

      <PrimaryToolbar />

      <div className="sdr-main">
        <section className="sdr-display">
          <div className="sdr-display-chrome">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-ink">
                {displayMode === "spectrometer3d" ? "3D Spectrometer" : "Spectrum"}
              </h2>
              <DisplayModeToggle
                value={displayMode}
                onChange={setDisplayMode}
              />
            </div>
            <p className="hidden text-xs text-muted sm:block">
              Click to tune · drag to pan · scroll to zoom
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
              onCenterOnOffset={onCenterOnOffset}
              onPanLo={onPanLo}
              markers={markers}
              settings={settings}
              onSettingsChange={updateSettings}
            />
          ) : (
            <SpectrometerLayout
              live={live}
              sampleRate={state.sampleRate}
              offsetHz={state.offsetHz}
              bandwidthHz={state.bandwidthHz}
              noiseFilter={settings.noiseFilter}
              onNoiseFilterChange={(noiseFilter) =>
                updateSettings({ noiseFilter })
              }
              onTuneOffset={onTuneOffset}
            />
          )}
        </section>

        <ControlRail
          freqTarget={settings.freqTarget}
          freqFormat={settings.freqFormat}
          onFreqTargetChange={(freqTarget) => updateSettings({ freqTarget })}
          onFreqFormatChange={(freqFormat) => updateSettings({ freqFormat })}
        />
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
  onCenterOnOffset: (offsetHz: number) => void;
  onPanLo: (deltaHz: number) => void;
  markers: SignalMarker[];
  settings: DisplaySettings;
  onSettingsChange: (patch: Partial<DisplaySettings>) => void;
};

function ScopeLayout({
  live,
  sampleRate,
  frequencyHz,
  offsetHz,
  bandwidthHz,
  onTuneOffset,
  onCenterOnOffset,
  onPanLo,
  markers,
  settings,
  onSettingsChange,
}: ScopeLayoutProps) {
  const [viewport, setViewport] = useState<SpectrumViewport>(DEFAULT_VIEWPORT);

  const onViewportChange = useCallback(
    (next: SpectrumViewport) => {
      setViewport(clampViewport(next, sampleRate));
    },
    [sampleRate],
  );

  const resetZoom = useCallback(() => {
    setViewport(DEFAULT_VIEWPORT);
  }, []);

  const clamped = useMemo(
    () => clampViewport(viewport, sampleRate),
    [viewport, sampleRate],
  );

  return (
    <>
      {live && (
        <SpectrumNavChrome
          sampleRate={sampleRate}
          viewport={clamped}
          onResetZoom={resetZoom}
        />
      )}

      <div className="relative min-h-48 flex-1 bg-canvas">
        {live ? (
          <SpectrumScope
            sampleRate={sampleRate}
            frequencyHz={frequencyHz}
            offsetHz={offsetHz}
            bandwidthHz={bandwidthHz}
            viewport={clamped}
            onViewportChange={onViewportChange}
            onTuneOffset={onTuneOffset}
            onCenterOnOffset={onCenterOnOffset}
            onPanLo={onPanLo}
            dbRange={settings.dbRange}
            noiseFilter={settings.noiseFilter}
            markers={markers}
          />
        ) : (
          <EmptyDisplay
            title="Waiting for RF"
            body="Connect an RTL-SDR stick, an OpenWebRX+ server, or start Demo to see the spectrum."
            showConnect
          />
        )}
      </div>

      <div className="sdr-waterfall-chrome">
        <h2 className="text-sm font-medium text-ink">Waterfall</h2>
        {live && (
          <WaterfallControls
            palette={settings.waterfallPalette}
            speed={settings.waterfallSpeed}
            direction={settings.waterfallDirection}
            dbRange={settings.dbRange}
            noiseFilter={settings.noiseFilter}
            onPaletteChange={(waterfallPalette) =>
              onSettingsChange({ waterfallPalette })
            }
            onSpeedChange={(waterfallSpeed) =>
              onSettingsChange({ waterfallSpeed })
            }
            onDirectionChange={(waterfallDirection) =>
              onSettingsChange({ waterfallDirection })
            }
            onDbRangeChange={(dbRange) => onSettingsChange({ dbRange })}
            onNoiseFilterChange={(noiseFilter) =>
              onSettingsChange({ noiseFilter })
            }
          />
        )}
        {!live && <p className="text-xs text-muted">Newest at top</p>}
      </div>

      <div className="relative min-h-52 flex-[1.15] bg-canvas">
        {live ? (
          <WaterfallDisplay
            sampleRate={sampleRate}
            frequencyHz={frequencyHz}
            offsetHz={offsetHz}
            bandwidthHz={bandwidthHz}
            viewport={clamped}
            onViewportChange={onViewportChange}
            onTuneOffset={onTuneOffset}
            onCenterOnOffset={onCenterOnOffset}
            onPanLo={onPanLo}
            paletteId={settings.waterfallPalette}
            speed={settings.waterfallSpeed}
            direction={settings.waterfallDirection}
            dbRange={settings.dbRange}
            noiseFilter={settings.noiseFilter}
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
  noiseFilter: NoiseFilterId;
  onNoiseFilterChange: (id: NoiseFilterId) => void;
  onTuneOffset: (offsetHz: number) => void;
};

function SpectrometerLayout({
  live,
  sampleRate,
  offsetHz,
  bandwidthHz,
  noiseFilter,
  onNoiseFilterChange,
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
              noiseFilter={noiseFilter}
              onTuneOffset={onTuneOffset}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-1.5">
            <p className="text-xs text-muted">
              Drag to orbit · scroll to zoom · click to tune · X frequency · Z
              time · Y power
            </p>
            <NoiseFilterControl
              value={noiseFilter}
              onChange={onNoiseFilterChange}
            />
          </div>
        </>
      ) : (
        <EmptyDisplay
          title="Waiting for RF"
          body="Connect an RTL-SDR stick, an OpenWebRX+ server, or start Demo to explore the 3D spectrometer."
          showConnect
        />
      )}
    </div>
  );
}

function EmptyDisplay({
  title,
  body,
  showConnect = false,
}: {
  title: string;
  body: string;
  showConnect?: boolean;
}) {
  const controller = useRadioController();
  const state = useSdrState();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const usbReady = mounted && state.webUsbSupported;
  const busy = state.status === "starting" || state.status === "stopping";

  return (
    <div className="empty-display">
      <p className="empty-display-title">{title}</p>
      <p className="empty-display-body">{body}</p>
      {showConnect && (
        <div className="empty-display-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !usbReady}
            onClick={() => void controller.connectDevice()}
          >
            Connect RTL-SDR
          </button>
          <OpenWebRxConnect align="center" />
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => void controller.connectDemo()}
          >
            Start Demo
          </button>
        </div>
      )}
    </div>
  );
}
