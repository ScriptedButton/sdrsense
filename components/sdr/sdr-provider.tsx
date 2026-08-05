"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { RadioController } from "@/lib/sdr/radio-controller";
import type { FskState } from "@/lib/sdr/fsk/types";
import { DEFAULT_FSK_CONFIG } from "@/lib/sdr/fsk/types";
import type { Ft8State } from "@/lib/sdr/ft8/types";
import { DEFAULT_FT8_CONFIG } from "@/lib/sdr/ft8/types";
import type { MorseState } from "@/lib/sdr/morse/types";
import { DEFAULT_MORSE_CONFIG } from "@/lib/sdr/morse/types";
import type { SignalIdState } from "@/lib/sdr/signal-id/types";
import type { TranscriptionState } from "@/lib/sdr/transcription-engine";
import { DEFAULT_SAMPLE_RATE, type SdrState } from "@/lib/sdr/types";

const ControllerContext = createContext<RadioController | null>(null);

/** Stable SSR snapshot — never reads browser APIs. */
const SERVER_STATE: SdrState = {
  connection: "disconnected",
  status: "idle",
  frequencyHz: 93_900_000,
  offsetHz: 0,
  sampleRate: DEFAULT_SAMPLE_RATE,
  scheme: "WBFM",
  volume: 0.8,
  autoGain: true,
  gainDb: 20,
  bandwidthHz: 150_000,
  squelch: 0,
  autoSquelch: false,
  squelchOpen: true,
  stereo: true,
  stereoActive: false,
  ppm: 0,
  biasTee: false,
  error: null,
  webUsbSupported: false,
};

export function SdrProvider({ children }: { children: ReactNode }) {
  const controller = useMemo(() => new RadioController(), []);

  useEffect(() => {
    controller.detectCapabilities();
  }, [controller]);

  return (
    <ControllerContext.Provider value={controller}>
      {children}
    </ControllerContext.Provider>
  );
}

export function useRadioController(): RadioController {
  const controller = useContext(ControllerContext);
  if (!controller) {
    throw new Error("useRadioController must be used within SdrProvider");
  }
  return controller;
}

export function useSdrState(): SdrState {
  const controller = useRadioController();
  return useSyncExternalStore(
    (onStoreChange) =>
      controller.subscribe(() => {
        onStoreChange();
      }),
    () => controller.getState(),
    () => SERVER_STATE,
  );
}

export function useSpectrumStream(
  onFrame: (spectrum: Float32Array, centerHz: number | undefined) => void,
): void {
  const controller = useRadioController();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    return controller.onSpectrum(onFrame);
  }, [controller, onFrame, ready]);
}

const SERVER_TRANSCRIPTION: TranscriptionState = {
  enabled: false,
  status: "idle",
  progress: 0,
  segments: [],
  error: null,
};

export function useTranscriptionState() {
  const controller = useRadioController();
  return useSyncExternalStore(
    (onStoreChange) =>
      controller.subscribeTranscription(() => {
        onStoreChange();
      }),
    () => controller.getTranscriptionState(),
    () => SERVER_TRANSCRIPTION,
  );
}

const SERVER_FSK: FskState = {
  enabled: false,
  status: "idle",
  config: DEFAULT_FSK_CONFIG,
  text: "",
  lastChar: null,
  lock: 0,
  error: null,
};

export function useFskState(): FskState {
  const controller = useRadioController();
  return useSyncExternalStore(
    (onStoreChange) =>
      controller.subscribeFsk(() => {
        onStoreChange();
      }),
    () => controller.getFskState(),
    () => SERVER_FSK,
  );
}

const SERVER_FT8: Ft8State = {
  enabled: false,
  status: "idle",
  config: DEFAULT_FT8_CONFIG,
  messages: [],
  cycleSec: 0,
  error: null,
};

export function useFt8State(): Ft8State {
  const controller = useRadioController();
  return useSyncExternalStore(
    (onStoreChange) =>
      controller.subscribeFt8(() => {
        onStoreChange();
      }),
    () => controller.getFt8State(),
    () => SERVER_FT8,
  );
}

const SERVER_MORSE: MorseState = {
  enabled: false,
  status: "idle",
  config: DEFAULT_MORSE_CONFIG,
  text: "",
  keywords: [],
  lastChar: null,
  wpmEstimate: DEFAULT_MORSE_CONFIG.wpm,
  lock: 0,
  error: null,
};

export function useMorseState(): MorseState {
  const controller = useRadioController();
  return useSyncExternalStore(
    (onStoreChange) =>
      controller.subscribeMorse(() => {
        onStoreChange();
      }),
    () => controller.getMorseState(),
    () => SERVER_MORSE,
  );
}

const SERVER_SIGNAL_ID: SignalIdState = {
  enabled: false,
  status: "idle",
  signals: [],
  noiseFloorDb: -100,
  error: null,
};

export function useSignalIdState(): SignalIdState {
  const controller = useRadioController();
  return useSyncExternalStore(
    (onStoreChange) =>
      controller.subscribeSignalId(() => {
        onStoreChange();
      }),
    () => controller.getSignalIdState(),
    () => SERVER_SIGNAL_ID,
  );
}
