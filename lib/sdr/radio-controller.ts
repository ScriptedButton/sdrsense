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
import { createDemoFskGenerator } from "./fsk/demo-signal";
import {
  FskDecoderEngine,
} from "./fsk/engine";
import type {
  FskConfig,
  FskListener,
  FskPresetId,
  FskState,
} from "./fsk/types";
import { createDemoFt8Generator } from "./ft8/demo-signal";
import { Ft8DecoderEngine } from "./ft8/engine";
import type {
  Ft8Config,
  Ft8Listener,
  Ft8State,
} from "./ft8/types";
import { createDemoMorseGenerator } from "./morse/demo-signal";
import { MorseDecoderEngine } from "./morse/engine";
import type {
  MorseConfig,
  MorseListener,
  MorsePresetId,
  MorseState,
} from "./morse/types";
import { createDemoP25Generator } from "./p25/demo-signal";
import { P25DecoderEngine } from "./p25/engine";
import { P25IqReceiver } from "./p25/iq-receiver";
import type {
  P25Config,
  P25Listener,
  P25State,
} from "./p25/types";
import { createDemoWefaxBank } from "./wefax/demo-signal";
import { WefaxDecoderEngine } from "./wefax/engine";
import type {
  WefaxConfig,
  WefaxListener,
  WefaxPresetId,
  WefaxState,
} from "./wefax/types";
import { DEMO_WEFAX_FREQUENCY_HZ } from "./wefax/types";
import { wefaxDemoCarriersHz } from "./wefax/stations";
import {
  SignalIdEngine,
  type SignalIdSensitivity,
} from "./signal-id/engine";
import type { SignalIdListener, SignalIdState } from "./signal-id/types";
import {
  AUTO_SQUELCH_DEFAULT_MARGIN_DB,
  SQUELCH_DEFAULT_DB,
  SQUELCH_MAX_DB,
  SQUELCH_MIN_DB,
  SquelchGate,
} from "./squelch";
import { TappingPlayer } from "./tapping-player";
import {
  TranscriptionEngine,
  type TranscriptionListener,
  type TranscriptionState,
} from "./transcription-engine";
import {
  DEFAULT_SAMPLE_RATE,
  FFT_SIZE,
  nearestSampleRate,
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
  const wefaxCarriers = [DEMO_WEFAX_FREQUENCY_HZ, ...wefaxDemoCarriersHz()];
  return sum(
    modulateFM(93.9e6, 75_000, 0.1, wbfmSignal(tone(600, 0.5), tone(400, 0.5))),
    modulateFM(88.5e6, 75_000, 0.08, wbfmSignal(tone(440, 0.5))),
    modulateAM(810e3, 0.1, tone(900, 0.5)),
    tone(14_225_750, 0.01),
    createDemoFskGenerator(0.09),
    createDemoFt8Generator(0.05),
    createDemoMorseGenerator(0.06),
    createDemoP25Generator(0.08),
    createDemoWefaxBank(wefaxCarriers, 0.06),
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
  private readonly fsk = new FskDecoderEngine();
  private readonly ft8 = new Ft8DecoderEngine();
  private readonly morse = new MorseDecoderEngine();
  private readonly wefax = new WefaxDecoderEngine();
  private readonly p25 = new P25DecoderEngine();
  private readonly p25Iq = new P25IqReceiver();
  private readonly signalId = new SignalIdEngine();
  private readonly squelchGate = new SquelchGate();
  private spectrumBuffer = new Float32Array(FFT_SIZE);
  private knownModes: Record<string, ReturnType<typeof getMode>> = {};
  private stateListeners = new Set<StateListener>();
  private spectrumListeners = new Set<SpectrumListener>();
  private lastSquelchEvalMs = 0;
  private digitalMute = false;
  private onSampleClick = () => this.emitSpectrum();
  private onTapAudio = (mono: Float32Array, sampleRate: number) => {
    this.transcription.pushAudio(mono, sampleRate);
    this.fsk.pushAudio(mono, sampleRate);
    this.ft8.pushAudio(mono, sampleRate);
    this.morse.pushAudio(mono, sampleRate);
    this.wefax.pushAudio(mono, sampleRate);
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
    squelch: SQUELCH_DEFAULT_DB,
    autoSquelch: false,
    squelchOpen: true,
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
    await this.transcription.setEnabled(enabled);
    this.syncTapping();
  }

  clearTranscript(): void {
    this.transcription.clear();
  }

  getFskState(): FskState {
    return this.fsk.getState();
  }

  subscribeFsk(listener: FskListener): () => void {
    return this.fsk.subscribe(listener);
  }

  setFskEnabled(enabled: boolean): void {
    this.fsk.setEnabled(enabled);
    this.syncTapping();
  }

  setFskPreset(preset: Exclude<FskPresetId, "custom">): void {
    this.fsk.setPreset(preset);
  }

  patchFskConfig(partial: Partial<FskConfig>): void {
    this.fsk.patchConfig(partial);
  }

  setFskInverted(inverted: boolean): void {
    this.fsk.setInverted(inverted);
  }

  clearFskText(): void {
    this.fsk.clear();
  }

  getFt8State(): Ft8State {
    return this.ft8.getState();
  }

  subscribeFt8(listener: Ft8Listener): () => void {
    return this.ft8.subscribe(listener);
  }

  setFt8Enabled(enabled: boolean): void {
    this.ft8.setEnabled(enabled);
    this.syncTapping();
  }

  patchFt8Config(partial: Partial<Ft8Config>): void {
    this.ft8.patchConfig(partial);
  }

  clearFt8Messages(): void {
    this.ft8.clear();
  }

  getMorseState(): MorseState {
    return this.morse.getState();
  }

  subscribeMorse(listener: MorseListener): () => void {
    return this.morse.subscribe(listener);
  }

  setMorseEnabled(enabled: boolean): void {
    this.morse.setEnabled(enabled);
    this.syncTapping();
  }

  setMorsePreset(preset: Exclude<MorsePresetId, "custom">): void {
    this.morse.setPreset(preset);
  }

  patchMorseConfig(partial: Partial<MorseConfig>): void {
    this.morse.patchConfig(partial);
  }

  clearMorseText(): void {
    this.morse.clear();
  }

  getWefaxState(): WefaxState {
    return this.wefax.getState();
  }

  subscribeWefax(listener: WefaxListener): () => void {
    return this.wefax.subscribe(listener);
  }

  getWefaxImage(): { pixels: Uint8Array; width: number; lines: number } {
    return this.wefax.getImage();
  }

  setWefaxEnabled(enabled: boolean): void {
    this.wefax.setEnabled(enabled);
    this.syncTapping();
  }

  setWefaxPreset(preset: Exclude<WefaxPresetId, "custom">): void {
    this.wefax.setPreset(preset);
  }

  patchWefaxConfig(partial: Partial<WefaxConfig>): void {
    this.wefax.patchConfig(partial);
  }

  setWefaxInverted(inverted: boolean): void {
    this.wefax.setInverted(inverted);
  }

  forceWefaxStart(): void {
    this.wefax.forceStart();
  }

  clearWefaxImage(): void {
    this.wefax.clear();
  }

  getP25State(): P25State {
    return this.p25.getState();
  }

  subscribeP25(listener: P25Listener): () => void {
    return this.p25.subscribe(listener);
  }

  async setP25Enabled(enabled: boolean): Promise<void> {
    this.bindP25Hooks();
    this.p25Iq.setEnabled(enabled);
    await this.p25.setEnabled(enabled);
    if (enabled) {
      this.setScheme("NBFM");
      this.p25Iq.setOffsetHz(this.state.offsetHz);
    } else {
      this.setDigitalMute(false);
    }
  }

  patchP25Config(partial: Partial<P25Config>): void {
    this.p25.patchConfig(partial);
  }

  clearP25Messages(): void {
    this.p25.clearMessages();
  }

  clearP25Calls(): void {
    this.p25.clearCalls();
  }

  getSignalIdState(): SignalIdState {
    return this.signalId.getState();
  }

  subscribeSignalId(listener: SignalIdListener): () => void {
    return this.signalId.subscribe(listener);
  }

  setSignalIdEnabled(enabled: boolean): void {
    this.signalId.setEnabled(enabled);
  }

  getSignalIdSensitivity(): SignalIdSensitivity {
    return this.signalId.getSensitivity();
  }

  setSignalIdSensitivity(sensitivity: SignalIdSensitivity): void {
    this.signalId.setSensitivity(sensitivity);
  }

  /** Tunes to an identified signal, switching demodulator to match its class. */
  tuneToSignal(offsetHz: number, scheme: DemodScheme | null): void {
    if (scheme) this.setScheme(scheme);
    this.setOffset(offsetHz);
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
    // Retuning invalidates every tracked signal and the frame history behind it.
    this.signalId.reset();
    if (this.radio) await this.radio.setFrequency(frequencyHz);
  }

  async nudgeFrequency(deltaHz: number): Promise<void> {
    await this.setFrequency(this.state.frequencyHz + deltaHz);
  }

  /**
   * Change the capture sample rate (spectrum width). webrtlsdr only applies
   * the rate on start, so a live session is briefly stopped and restarted.
   */
  async setSampleRate(hz: number): Promise<void> {
    const requested = nearestSampleRate(hz);
    if (requested === this.state.sampleRate) return;

    const half = requested / 2;
    const offsetHz = clamp(this.state.offsetHz, -half, half);
    this.patch({ sampleRate: requested, offsetHz, error: null });
    this.signalId.reset();
    this.demodulator?.setFrequencyOffset(offsetHz);

    if (!this.radio) return;

    const wasPlaying = this.radio.isPlaying();
    try {
      if (wasPlaying) {
        this.patch({ status: "starting" });
        await this.radio.stop();
      }
      await this.radio.setSampleRate(requested);
      if (wasPlaying) {
        await this.radio.start();
        const actual = this.radio.getSampleRate();
        const halfActual = actual / 2;
        this.patch({
          sampleRate: actual,
          offsetHz: clamp(offsetHz, -halfActual, halfActual),
          status: "playing",
        });
        this.demodulator?.setFrequencyOffset(this.state.offsetHz);
        this.p25Iq.setSampleRate(actual);
        this.p25Iq.setOffsetHz(this.state.offsetHz);
      }
    } catch (err) {
      this.patch({
        status: "error",
        error: errorMessage(err),
      });
    }
  }

  setOffset(hz: number): void {
    const half = this.state.sampleRate / 2;
    const offsetHz = clamp(Math.round(hz), -half, half);
    this.patch({ offsetHz });
    this.demodulator?.setFrequencyOffset(offsetHz);
    this.p25Iq.setOffsetHz(offsetHz);
  }

  /**
   * Tune the demodulator to an absolute frequency. Uses the offset when the
   * target sits comfortably inside the current sample window; otherwise retunes
   * the LO and clears the offset.
   */
  tuneToHz(absoluteHz: number): void {
    const target = Math.round(absoluteHz);
    const half = this.state.sampleRate / 2;
    const offset = target - this.state.frequencyHz;
    if (Math.abs(offset) <= half * 0.92) {
      this.setOffset(offset);
      return;
    }
    void this.setFrequency(target).then(() => this.setOffset(0));
  }

  /** Retune the LO so `absoluteHz` sits at center and clear the offset. */
  centerOnHz(absoluteHz: number): void {
    void this.setFrequency(Math.round(absoluteHz)).then(() => this.setOffset(0));
  }

  /**
   * Slide the LO by `deltaHz` while keeping the absolute listen frequency
   * stable (offset absorbs the opposite of the LO move).
   */
  async panFrequency(deltaHz: number): Promise<void> {
    if (deltaHz === 0) return;
    const listenHz = this.state.frequencyHz + this.state.offsetHz;
    await this.setFrequency(this.state.frequencyHz + deltaHz);
    this.setOffset(listenHz - this.state.frequencyHz);
  }

  setVolume(volume: number): void {
    const v = clamp(volume, 0, 1);
    this.patch({ volume: v });
    if (!this.digitalMute) {
      this.demodulator?.setVolume(v);
    }
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
    // Keep app squelch settings; library squelch stays at 0 (we gate in the player).
    if (params.hasSquelch()) {
      const cleared = params.setSquelch(0);
      this.demodulator?.setMode(cleared.mode);
      this.knownModes[scheme] = cleared.mode;
    }
    this.patch({
      scheme,
      bandwidthHz: params.getBandwidth(),
      stereo: params.hasStereo() ? params.getStereo() : false,
    });
  }

  setBandwidth(hz: number): void {
    const scheme = this.state.scheme;
    const base =
      this.demodulator?.getMode() ??
      this.knownModes[scheme] ??
      getMode(scheme);
    const params = modeParameters(base);
    if (!params.hasBandwidth()) return;
    const next = params.setBandwidth(hz);
    this.knownModes[next.mode.scheme] = next.mode;
    this.demodulator?.setMode(next.mode);
    this.patch({ bandwidthHz: next.getBandwidth() });
  }

  setSquelch(level: number): void {
    const squelch = clamp(Math.round(level), SQUELCH_MIN_DB, SQUELCH_MAX_DB);
    this.patch({ squelch });
    if (!this.squelchActive()) {
      this.forceSquelchOpen();
    }
  }

  setAutoSquelch(enabled: boolean): void {
    this.patch({ autoSquelch: enabled });
    this.squelchGate.reset();
    if (!enabled && this.state.squelch <= 0) {
      this.forceSquelchOpen();
    } else if (enabled && this.state.squelch <= 0) {
      // Give auto a usable default margin when the slider was off.
      this.patch({ squelch: AUTO_SQUELCH_DEFAULT_MARGIN_DB });
    }
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
    player.setTapping(this.wantAudioTap());
    this.untap = player.onAudio(this.onTapAudio);

    const demodulator = new Demodulator({ player });
    const spectrum = new Spectrum(FFT_SIZE);
    const sampleCounter = new SampleCounter(20);
    this.p25Iq.setSampleRate(this.state.sampleRate);
    this.p25Iq.setOffsetHz(this.state.offsetHz);
    this.p25Iq.setSink((dibits, lock) => this.p25.pushDibits(dibits, lock));
    this.bindP25Hooks();
    const receiver = CompositeReceiver.of(
      spectrum,
      demodulator,
      sampleCounter,
      this.p25Iq,
    );
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

      const baseMode = this.knownModes[this.state.scheme] ?? getMode("WBFM");
      let mode = baseMode;
      const params = modeParameters(mode);
      if (params.hasSquelch()) {
        mode = params.setSquelch(0).mode;
        this.knownModes[mode.scheme] = mode;
      }
      demodulator.setMode(mode);

      this.squelchGate.reset();
      this.lastSquelchEvalMs = 0;
      this.player?.setSquelched(false);

      this.patch({
        bandwidthHz: modeParameters(mode).getBandwidth(),
        stereo: modeParameters(mode).hasStereo()
          ? modeParameters(mode).getStereo()
          : false,
        squelchOpen: true,
      });

      await radio.start();
      const actualRate = radio.getSampleRate();
      const half = actualRate / 2;
      this.p25Iq.setSampleRate(actualRate);
      this.patch({
        sampleRate: actualRate,
        offsetHz: clamp(this.state.offsetHz, -half, half),
        status: "playing",
      });
      demodulator.setFrequencyOffset(this.state.offsetHz);
      this.p25Iq.setOffsetHz(this.state.offsetHz);
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
    if (!this.spectrum) return;
    const scanning = this.signalId.getState().enabled;
    const squelchOn = this.squelchActive();
    if (this.spectrumListeners.size === 0 && !scanning && !squelchOn) return;

    this.spectrum.getSpectrum(this.spectrumBuffer);
    const center = this.spectrum.frequency();

    if (squelchOn) {
      this.evaluateSquelch();
    }

    if (scanning) {
      this.signalId.pushSpectrum(
        this.spectrumBuffer,
        center,
        this.state.sampleRate,
        this.state.frequencyHz,
      );
    }
    for (const listener of this.spectrumListeners) {
      listener(this.spectrumBuffer, center);
    }
  }

  private squelchActive(): boolean {
    return this.state.autoSquelch || this.state.squelch > 0;
  }

  private forceSquelchOpen(): void {
    this.squelchGate.reset();
    this.player?.setSquelched(false);
    if (!this.state.squelchOpen) {
      this.patch({ squelchOpen: true });
    }
  }

  private evaluateSquelch(): void {
    const now = performance.now();
    const dtSeconds =
      this.lastSquelchEvalMs > 0
        ? Math.min(0.5, (now - this.lastSquelchEvalMs) / 1000)
        : 0.05;
    this.lastSquelchEvalMs = now;

    const decision = this.squelchGate.updateFromSpectrum(
      this.spectrumBuffer,
      this.state.sampleRate,
      this.state.offsetHz,
      this.state.bandwidthHz,
      this.state.squelch,
      this.state.autoSquelch,
      dtSeconds,
    );

    this.player?.setSquelched(!decision.open);
    if (decision.open !== this.state.squelchOpen) {
      this.patch({ squelchOpen: decision.open });
    }
  }

  private teardown(): void {
    this.signalId.reset();
    this.squelchGate.reset();
    this.lastSquelchEvalMs = 0;
    this.p25Iq.setEnabled(false);
    this.p25Iq.reset();
    this.setDigitalMute(false);
    this.sampleCounter?.removeEventListener("sample-click", this.onSampleClick);
    this.untap?.();
    this.untap = null;
    this.player?.setTapping(false);
    this.player?.setSquelched(false);
    this.player = null;
    this.radio = null;
    this.demodulator = null;
    this.spectrum = null;
    this.sampleCounter = null;
  }

  private bindP25Hooks(): void {
    this.p25.setRadioHooks({
      setFrequency: (hz) => this.setFrequency(hz),
      setOffset: (hz) => this.setOffset(hz),
      setSchemeNbfm: () => this.setScheme("NBFM"),
      setDigitalMute: (muted) => this.setDigitalMute(muted),
      getFrequency: () => this.state.frequencyHz,
      getOffset: () => this.state.offsetHz,
    });
  }

  private setDigitalMute(muted: boolean): void {
    this.digitalMute = muted;
    if (!this.demodulator) return;
    this.demodulator.setVolume(muted ? 0 : this.state.volume);
  }

  private wantAudioTap(): boolean {
    return (
      this.transcription.getState().enabled ||
      this.fsk.getState().enabled ||
      this.ft8.getState().enabled ||
      this.morse.getState().enabled ||
      this.wefax.getState().enabled
    );
  }

  private syncTapping(): void {
    this.player?.setTapping(this.wantAudioTap());
  }

  private patch(partial: Partial<SdrState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.stateListeners) {
      listener(this.state);
    }
  }
}
