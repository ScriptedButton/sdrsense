export type ConnectionMode = "disconnected" | "device" | "demo";

export type RadioStatus =
  | "idle"
  | "starting"
  | "playing"
  | "stopping"
  | "error";

export type DemodScheme = "WBFM" | "NBFM" | "AM" | "USB" | "LSB" | "CW";

export type SdrState = {
  connection: ConnectionMode;
  status: RadioStatus;
  frequencyHz: number;
  offsetHz: number;
  sampleRate: number;
  scheme: DemodScheme;
  volume: number;
  autoGain: boolean;
  gainDb: number;
  bandwidthHz: number;
  squelch: number;
  stereo: boolean;
  stereoActive: boolean;
  ppm: number;
  biasTee: boolean;
  error: string | null;
  webUsbSupported: boolean;
};

export type BandPreset = {
  id: string;
  label: string;
  frequencyHz: number;
  scheme: DemodScheme;
};

export const DEFAULT_SAMPLE_RATE = 1_024_000;
export const FFT_SIZE = 2048;
export const MIN_DB = -90;
export const MAX_DB = -20;
