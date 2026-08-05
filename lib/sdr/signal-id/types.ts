import type { DemodScheme } from "../types";

/**
 * Modulation classes the model can identify. These are RF-native labels derived
 * from spectral shape and how it moves over time, not audio content.
 */
export const SIGNAL_CLASSES = [
  "CW",
  "CARRIER",
  "AM",
  "USB",
  "LSB",
  "NBFM",
  "WBFM",
  "FSK",
  "DIGITAL",
  "NOISE",
] as const;

export type SignalClass = (typeof SIGNAL_CLASSES)[number];

export const CLASS_COUNT = SIGNAL_CLASSES.length;

/**
 * What the UI shows. "SSB" is never predicted directly — it is reported when
 * the model cannot separate upper from lower sideband, which the FFT's 500 Hz
 * resolution frequently makes impossible.
 */
export type DisplayClass = SignalClass | "SSB";

/** A contiguous run of bins that rose above the detection threshold. */
export type Detection = {
  /** Inclusive bin index of the lower band edge, in frequency-ordered bins. */
  loBin: number;
  /** Inclusive bin index of the upper band edge. */
  hiBin: number;
  peakBin: number;
  peakDb: number;
};

/**
 * One analysis window for a tracked signal: the detected band plus the recent
 * frame history that temporal features are computed from.
 */
export type FeatureWindow = {
  /** Most recent frames, frequency-ordered (DC centered), oldest first. */
  frames: Float32Array[];
  detection: Detection;
  noiseFloorDb: number;
  binHz: number;
};

export type SignalIdStatus = "idle" | "scanning" | "error";

/** Best SigID-catalog guess for what this emission actually is. */
export type SignalIdentity = {
  id: string;
  name: string;
  url: string;
  score: number;
  description?: string;
  categories: string[];
  mode?: string;
  modulation?: string;
};

export type IdentifiedSignal = {
  /** Stable across frames while the signal persists, so React rows do not remount. */
  id: string;
  /** Absolute tuned frequency of the signal's peak. */
  frequencyHz: number;
  /** Offset from the receiver's center frequency. */
  offsetHz: number;
  bandwidthHz: number;
  snrDb: number;
  label: DisplayClass;
  confidence: number;
  /** Demodulator to switch to when the user tunes this signal, if one applies. */
  scheme: DemodScheme | null;
  /** Top SigID wiki matches for frequency + bandwidth + modulation. */
  identities: SignalIdentity[];
  firstSeen: number;
  lastSeen: number;
};

export type SignalIdState = {
  enabled: boolean;
  status: SignalIdStatus;
  signals: IdentifiedSignal[];
  noiseFloorDb: number;
  error: string | null;
};

export type SignalIdListener = (state: SignalIdState) => void;
