import { Demodulator } from "@jtarrio/signals/demod/demodulator.js";
import {
  getMode,
  getSchemes,
  modeParameters,
} from "@jtarrio/signals/demod/modes.js";
import { SampleCounter } from "@jtarrio/signals/demod/sample-counter.js";
import { Spectrum } from "@jtarrio/signals/demod/spectrum.js";
import { CompositeReceiver } from "@jtarrio/signals/radio/sample_receiver.js";
import {
  modulateAM,
  modulateFM,
  noise,
  sum,
  tone,
  wbfmSignal,
} from "@jtarrio/signals/sources/generators.js";
import { FakeRtlDeviceProvider } from "@jtarrio/webrtlsdr/fakertl/fakertl.js";
import { Radio, RtlProvider } from "@jtarrio/webrtlsdr/radio.js";
import { DirectSampling } from "@jtarrio/webrtlsdr/rtlsdr.js";

import { clamp } from "./format";
import { TappingPlayer } from "./tapping-player";
import {
  TranscriptionEngine,
  type TranscriptionListener,
  type TranscriptionState,
} from "./transcription-engine";
import {
  DEFAULT_SAMPLE_RATE,
  FFT_SIZE,
  type ConnectionMode,
  type DemodScheme,
  type SdrState,
} from "./types";

export type SpectrumListener = (
  spectrum: Float32Array,
  centerHz: number | undefined,
) => void;

export type StateListener = (state: SdrState) => void;

function isWebUsbSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

function createDemoGenerator() {
  return sum(
    modulateFM(93.9e6, 75_000, 0.1, wbfmSignal(tone(600, 0.5), tone(400, 0.5))),
    modulateFM(88.5e6, 75_000, 0.08, wbfmSignal(tone(440, 0.5))),
    modulateAM(810e3, 0.1, tone(900, 0.5)),
    tone(14_225_750, 0.01),
    noise(0.03),
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "NotFoundError") {
      return "No device selected. Plug in your RTL-SDR and try again.";
    }
    if (err.name === "SecurityError") {
      return "WebUSB blocked. Use HTTPS or localhost in Chrome/Edge.";
    }
    if (err.name === "NetworkError" || /claim/i.test(err.message)) {
      return "Could not claim the USB device. Close other SDR apps and retry (on Linux, unload dvb_usb_rtl28xxu).";
    }
    return err.message;
  }
  return String(err);
}

export class RadioController {
  private radio: Radio | null = null;
  private demodulator: Demodulator | null = null;
  private spectrum: Spectrum | null = null;
  private sampleCounter: SampleCounter | null = null;
  private player: TappingPlayer | null = null;
  private untap: (() => void) | null = null;
  private readonly transcription = new TranscriptionEngine();
  private spectrumBuffer = new Float32Array(FFT_SIZE);
  private knownModes: Record<string, ReturnType<typeof getMode>> = {};
  private stateListeners = new Set<StateListener>();
  private spectrumListeners = new Set<SpectrumListener>();
  private onSampleClick = () => this.emitSpectrum();
  private onTapAudio = (mono: Float32Array, sampleRate: number) => {
    this.transcription.pushAudio(mono, sampleRate);
  };

  private state: SdrState = {
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
    stereo: true,
    stereoActive: false,
    ppm: 0,
    biasTee: false,
    error: null,
    // Detect after mount to avoid SSR/client hydration mismatch.
    webUsbSupported: false,
  };

  getState(): SdrState {
    return this.state;
  }

  detectCapabilities(): void {
    this.patch({ webUsbSupported: isWebUsbSupported() });
  }

  subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    // Do not call listener synchronously — useSyncExternalStore forbids it.
    return () => this.stateListeners.delete(listener);
  }

  onSpectrum(listener: SpectrumListener): () => void {
    this.spectrumListeners.add(listener);
    return () => this.spectrumListeners.delete(listener);
  }

  getTranscriptionState(): TranscriptionState {
    return this.transcription.getState();
  }

  subscribeTranscription(listener: TranscriptionListener): () => void {
    return this.transcription.subscribe(listener);
  }

  async setTranscriptionEnabled(enabled: boolean): Promise<void> {
    this.player?.setTapping(enabled);
    await this.transcription.setEnabled(enabled);
  }

  clearTranscript(): void {
    this.transcription.clear();
  }

  getSchemes(): string[] {
    return getSchemes();
  }

  async connectDevice(): Promise<void> {
    if (!isWebUsbSupported()) {
      this.patch({
        error:
          "WebUSB is not available. Use Chrome, Edge, or Opera on desktop or Android.",
      });
      return;
    }
    await this.startWithProvider(new RtlProvider(), "device");
  }

  async connectDemo(): Promise<void> {
    const fake = new FakeRtlDeviceProvider(createDemoGenerator());
    await this.startWithProvider(new RtlProvider(fake), "demo");
  }

  async stop(): Promise<void> {
    if (!this.radio) return;
    this.patch({ status: "stopping", error: null });
    try {
      await this.radio.stop();
    } catch (err) {
      this.patch({ status: "error", error: errorMessage(err) });
      return;
    }
    this.teardown();
    this.patch({
      connection: "disconnected",
      status: "idle",
      stereoActive: false,
    });
  }

  async setFrequency(hz: number): Promise<void> {
    const frequencyHz = clamp(Math.round(hz), 0, 1_766_000_000);
    this.patch({ frequencyHz });
    if (this.radio) await this.radio.setFrequency(frequencyHz);
  }

  async nudgeFrequency(deltaHz: number): Promise<void> {
    await this.setFrequency(this.state.frequencyHz + deltaHz);
  }

  setOffset(hz: number): void {
    const offsetHz = Math.round(hz);
    this.patch({ offsetHz });
    this.demodulator?.setFrequencyOffset(offsetHz);
  }

  setVolume(volume: number): void {
    const v = clamp(volume, 0, 1);
    this.patch({ volume: v });
    this.demodulator?.setVolume(v);
  }

  async setAutoGain(auto: boolean): Promise<void> {
    this.patch({ autoGain: auto });
    if (!this.radio) return;
    await this.radio.setGain(auto ? null : this.state.gainDb);
  }

  async setGain(db: number): Promise<void> {
    const gainDb = clamp(db, 0, 50);
    this.patch({ gainDb, autoGain: false });
    if (this.radio) await this.radio.setGain(gainDb);
  }

  setScheme(scheme: DemodScheme): void {
    if (!this.knownModes[scheme]) {
      this.knownModes[scheme] = getMode(scheme);
    }
    const mode = this.knownModes[scheme];
    this.demodulator?.setMode(mode);
    const params = modeParameters(mode);
    this.patch({
      scheme,
      bandwidthHz: params.getBandwidth(),
      squelch: params.getSquelch(),
      stereo: params.hasStereo() ? params.getStereo() : false,
    });
  }

  setBandwidth(hz: number): void {
    if (!this.demodulator) return;
    const params = modeParameters(this.demodulator.getMode());
    if (!params.hasBandwidth()) return;
    const next = params.setBandwidth(hz);
    this.demodulator.setMode(next.mode);
    this.knownModes[next.mode.scheme] = next.mode;
    this.patch({ bandwidthHz: next.getBandwidth() });
  }

  setSquelch(level: number): void {
    if (!this.demodulator) return;
    const params = modeParameters(this.demodulator.getMode());
    if (!params.hasSquelch()) return;
    const next = params.setSquelch(level);
    this.demodulator.setMode(next.mode);
    this.knownModes[next.mode.scheme] = next.mode;
    this.patch({ squelch: next.getSquelch() });
  }

  setStereo(stereo: boolean): void {
    if (!this.demodulator) return;
    const params = modeParameters(this.demodulator.getMode());
    if (!params.hasStereo()) return;
    const next = params.setStereo(stereo);
    this.demodulator.setMode(next.mode);
    this.knownModes[next.mode.scheme] = next.mode;
    this.patch({ stereo });
  }

  async setPpm(ppm: number): Promise<void> {
    const value = clamp(Math.round(ppm), -200, 200);
    this.patch({ ppm: value });
    if (this.radio) await this.radio.setFrequencyCorrection(value);
  }

  async setBiasTee(enabled: boolean): Promise<void> {
    this.patch({ biasTee: enabled });
    if (this.radio) await this.radio.enableBiasTee(enabled);
  }

  private async startWithProvider(
    provider: RtlProvider,
    connection: ConnectionMode,
  ): Promise<void> {
    await this.stop();
    this.patch({ status: "starting", error: null, connection });

    const player = new TappingPlayer();
    const wantTap = this.transcription.getState().enabled;
    player.setTapping(wantTap);
    this.untap = player.onAudio(this.onTapAudio);

    const demodulator = new Demodulator({ player });
    const spectrum = new Spectrum(FFT_SIZE);
    const sampleCounter = new SampleCounter(20);
    const receiver = CompositeReceiver.of(spectrum, demodulator, sampleCounter);
    const radio = new Radio(provider, receiver);

    this.player = player;
    this.demodulator = demodulator;
    this.spectrum = spectrum;
    this.sampleCounter = sampleCounter;
    this.radio = radio;

    for (const scheme of getSchemes()) {
      this.knownModes[scheme] = getMode(scheme);
    }

    sampleCounter.addEventListener("sample-click", this.onSampleClick);
    radio.addEventListener("radio", (e) => this.onRadioEvent(e.detail));
    demodulator.addEventListener("stereo-status", (e) => {
      this.patch({ stereoActive: Boolean(e.detail) });
    });

    try {
      await radio.setSampleRate(this.state.sampleRate);
      await radio.setFrequency(this.state.frequencyHz);
      await radio.setDirectSamplingMethod(DirectSampling.Q);
      await radio.setFrequencyCorrection(this.state.ppm);
      await radio.setGain(this.state.autoGain ? null : this.state.gainDb);
      await radio.enableBiasTee(this.state.biasTee);

      demodulator.setVolume(this.state.volume);
      demodulator.setFrequencyOffset(this.state.offsetHz);
      demodulator.setMode(this.knownModes[this.state.scheme] ?? getMode("WBFM"));

      const params = modeParameters(demodulator.getMode());
      this.patch({
        bandwidthHz: params.getBandwidth(),
        squelch: params.getSquelch(),
        stereo: params.hasStereo() ? params.getStereo() : false,
      });

      await radio.start();
      this.patch({ status: "playing" });
    } catch (err) {
      this.teardown();
      this.patch({
        connection: "disconnected",
        status: "error",
        error: errorMessage(err),
      });
    }
  }

  private onRadioEvent(detail: { type: string; exception?: unknown; active?: boolean }) {
    if (detail.type === "started") {
      this.patch({ status: "playing" });
    } else if (detail.type === "stopped") {
      this.patch({ status: "idle" });
    } else if (detail.type === "error") {
      this.patch({
        status: "error",
        error: errorMessage(detail.exception ?? "Radio error"),
      });
    }
  }

  private emitSpectrum(): void {
    if (!this.spectrum || this.spectrumListeners.size === 0) return;
    this.spectrum.getSpectrum(this.spectrumBuffer);
    const center = this.spectrum.frequency();
    for (const listener of this.spectrumListeners) {
      listener(this.spectrumBuffer, center);
    }
  }

  private teardown(): void {
    this.sampleCounter?.removeEventListener("sample-click", this.onSampleClick);
    this.untap?.();
    this.untap = null;
    this.player?.setTapping(false);
    this.player = null;
    this.radio = null;
    this.demodulator = null;
    this.spectrum = null;
    this.sampleCounter = null;
  }

  private patch(partial: Partial<SdrState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.stateListeners) {
      listener(this.state);
    }
  }
}
