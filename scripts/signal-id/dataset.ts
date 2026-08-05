import {
  detectSignals,
  estimateNoiseFloor,
  shiftSpectrum,
} from "../../lib/sdr/signal-id/detector";
import { extractFeatures, FEATURE_COUNT } from "../../lib/sdr/signal-id/features";
import { SIGNAL_CLASSES, type Detection, type SignalClass } from "../../lib/sdr/signal-id/types";
import { FFT_SIZE } from "../../lib/sdr/types";
import { BIN_HZ, Rng, synthesize, synthesizeNoiseFloor } from "./synth";

export type Dataset = {
  x: Float32Array[];
  y: number[];
};

export type BuildOptions = {
  perClass: number;
  frames: number;
  seed: number;
  onProgress?: (done: number, total: number) => void;
};

/** Picks the detection that actually corresponds to the synthesised emitter. */
function matchDetection(
  detections: Detection[],
  trueBin: number,
): Detection | null {
  let best: Detection | null = null;
  let bestDistance = Infinity;
  for (const d of detections) {
    const width = d.hiBin - d.loBin + 1;
    const tolerance = Math.max(4, width);
    const inside = trueBin >= d.loBin - tolerance && trueBin <= d.hiBin + tolerance;
    if (!inside) continue;
    const distance = Math.abs(d.peakBin - trueBin);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = d;
    }
  }
  return best;
}

export function buildDataset(options: BuildOptions): Dataset {
  const { perClass, frames, seed } = options;
  const rng = new Rng(seed);
  const x: Float32Array[] = [];
  const y: number[] = [];

  const missed = new Map<SignalClass, number>();
  const total = SIGNAL_CLASSES.length * perClass;
  let done = 0;

  for (let classIndex = 0; classIndex < SIGNAL_CLASSES.length; classIndex++) {
    const cls = SIGNAL_CLASSES[classIndex];
    let produced = 0;
    let attempts = 0;
    const maxAttempts = perClass * 4;

    while (produced < perClass && attempts < maxAttempts) {
      attempts++;

      // A quarter of NOISE examples come from bare receiver noise, so the model
      // learns to dismiss the detector's own false positives.
      const bareNoise = cls === "NOISE" && rng.next() < 0.25;
      const sample = bareNoise
        ? synthesizeNoiseFloor(rng, frames)
        : synthesize(cls, rng, frames);

      const shifted = sample.frames.map((f) => shiftSpectrum(f));
      const latest = shifted[shifted.length - 1];
      const noiseFloorDb = estimateNoiseFloor(latest);
      const detections = detectSignals(latest, noiseFloorDb);
      if (detections.length === 0) continue;

      let detection: Detection | null;
      if (bareNoise) {
        detection = detections[Math.floor(rng.next() * detections.length)] ?? null;
      } else {
        const trueBin = Math.round(sample.offsetHz / BIN_HZ) + FFT_SIZE / 2;
        detection = matchDetection(detections, trueBin);
      }
      if (!detection) continue;

      const features = extractFeatures({
        frames: shifted,
        detection,
        noiseFloorDb,
        binHz: BIN_HZ,
      });

      x.push(features);
      y.push(classIndex);
      produced++;
      done++;
      options.onProgress?.(done, total);
    }

    if (produced < perClass) {
      missed.set(cls, perClass - produced);
    }
  }

  if (missed.size > 0) {
    const summary = [...missed.entries()].map(([c, n]) => `${c}:${n}`).join(" ");
    console.warn(`  under-filled classes (signal below detection threshold): ${summary}`);
  }

  return { x, y };
}

/** Shuffles in place with the supplied RNG so splits are reproducible. */
export function shuffle(data: Dataset, rng: Rng): void {
  for (let i = data.x.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [data.x[i], data.x[j]] = [data.x[j], data.x[i]];
    [data.y[i], data.y[j]] = [data.y[j], data.y[i]];
  }
}

export function split(data: Dataset, testFraction: number): [Dataset, Dataset] {
  const testCount = Math.floor(data.x.length * testFraction);
  const test: Dataset = {
    x: data.x.slice(0, testCount),
    y: data.y.slice(0, testCount),
  };
  const train: Dataset = {
    x: data.x.slice(testCount),
    y: data.y.slice(testCount),
  };
  return [train, test];
}

/** Per-feature mean and standard deviation used to standardise model inputs. */
export function standardisation(data: Dataset): { mean: number[]; std: number[] } {
  const mean = new Array<number>(FEATURE_COUNT).fill(0);
  const std = new Array<number>(FEATURE_COUNT).fill(0);
  const n = data.x.length;
  if (n === 0) return { mean, std: std.map(() => 1) };

  for (const row of data.x) {
    for (let i = 0; i < FEATURE_COUNT; i++) mean[i] += row[i];
  }
  for (let i = 0; i < FEATURE_COUNT; i++) mean[i] /= n;

  for (const row of data.x) {
    for (let i = 0; i < FEATURE_COUNT; i++) {
      const d = row[i] - mean[i];
      std[i] += d * d;
    }
  }
  for (let i = 0; i < FEATURE_COUNT; i++) {
    std[i] = Math.sqrt(std[i] / n) || 1;
  }

  return { mean, std };
}
