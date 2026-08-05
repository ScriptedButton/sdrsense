import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { FEATURE_COUNT, FEATURE_NAMES } from "../../lib/sdr/signal-id/features";
import { argmax, softmax, type LayerWeights, type ModelWeights } from "../../lib/sdr/signal-id/mlp";
import { SIGNAL_CLASSES } from "../../lib/sdr/signal-id/types";
import {
  buildDataset,
  shuffle,
  split,
  standardisation,
  type Dataset,
} from "./dataset";
import { Rng } from "./synth";

const HIDDEN = [56, 36];
const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../lib/sdr/signal-id/model-weights.json",
);

type Layer = {
  inSize: number;
  outSize: number;
  w: Float64Array;
  b: Float64Array;
  gw: Float64Array;
  gb: Float64Array;
  mw: Float64Array;
  vw: Float64Array;
  mb: Float64Array;
  vb: Float64Array;
  z: Float64Array;
  a: Float64Array;
  delta: Float64Array;
  relu: boolean;
};

function makeLayer(inSize: number, outSize: number, relu: boolean, rng: Rng): Layer {
  const w = new Float64Array(inSize * outSize);
  // He initialisation, matched to the ReLU activations.
  const scale = Math.sqrt(2 / inSize);
  for (let i = 0; i < w.length; i++) w[i] = rng.normal() * scale;
  return {
    inSize,
    outSize,
    w,
    b: new Float64Array(outSize),
    gw: new Float64Array(inSize * outSize),
    gb: new Float64Array(outSize),
    mw: new Float64Array(inSize * outSize),
    vw: new Float64Array(inSize * outSize),
    mb: new Float64Array(outSize),
    vb: new Float64Array(outSize),
    z: new Float64Array(outSize),
    a: new Float64Array(outSize),
    delta: new Float64Array(outSize),
    relu,
  };
}

function forwardPass(layers: Layer[], input: Float64Array): Float64Array {
  let current = input;
  for (const layer of layers) {
    for (let o = 0; o < layer.outSize; o++) {
      let sum = layer.b[o];
      const base = o * layer.inSize;
      for (let i = 0; i < layer.inSize; i++) sum += layer.w[base + i] * current[i];
      layer.z[o] = sum;
      layer.a[o] = layer.relu ? Math.max(0, sum) : sum;
    }
    current = layer.a;
  }
  return current;
}

function backwardPass(
  layers: Layer[],
  input: Float64Array,
  probs: Float64Array,
  target: number,
): void {
  const last = layers[layers.length - 1];
  for (let o = 0; o < last.outSize; o++) {
    last.delta[o] = probs[o] - (o === target ? 1 : 0);
  }

  for (let l = layers.length - 1; l >= 0; l--) {
    const layer = layers[l];
    const prev = l > 0 ? layers[l - 1].a : input;

    for (let o = 0; o < layer.outSize; o++) {
      const d = layer.delta[o];
      if (d === 0) continue;
      const base = o * layer.inSize;
      for (let i = 0; i < layer.inSize; i++) layer.gw[base + i] += d * prev[i];
      layer.gb[o] += d;
    }

    if (l > 0) {
      const below = layers[l - 1];
      below.delta.fill(0);
      for (let o = 0; o < layer.outSize; o++) {
        const d = layer.delta[o];
        if (d === 0) continue;
        const base = o * layer.inSize;
        for (let i = 0; i < layer.inSize; i++) below.delta[i] += d * layer.w[base + i];
      }
      for (let i = 0; i < below.outSize; i++) {
        if (below.relu && below.z[i] <= 0) below.delta[i] = 0;
      }
    }
  }
}

function adamStep(
  layers: Layer[],
  lr: number,
  step: number,
  batchSize: number,
  weightDecay: number,
): void {
  const beta1 = 0.9;
  const beta2 = 0.999;
  const eps = 1e-8;
  const bc1 = 1 - Math.pow(beta1, step);
  const bc2 = 1 - Math.pow(beta2, step);

  for (const layer of layers) {
    for (let i = 0; i < layer.w.length; i++) {
      const g = layer.gw[i] / batchSize + weightDecay * layer.w[i];
      layer.mw[i] = beta1 * layer.mw[i] + (1 - beta1) * g;
      layer.vw[i] = beta2 * layer.vw[i] + (1 - beta2) * g * g;
      layer.w[i] -= (lr * (layer.mw[i] / bc1)) / (Math.sqrt(layer.vw[i] / bc2) + eps);
      layer.gw[i] = 0;
    }
    for (let o = 0; o < layer.b.length; o++) {
      const g = layer.gb[o] / batchSize;
      layer.mb[o] = beta1 * layer.mb[o] + (1 - beta1) * g;
      layer.vb[o] = beta2 * layer.vb[o] + (1 - beta2) * g * g;
      layer.b[o] -= (lr * (layer.mb[o] / bc1)) / (Math.sqrt(layer.vb[o] / bc2) + eps);
      layer.gb[o] = 0;
    }
  }
}

function standardise(
  data: Dataset,
  mean: number[],
  std: number[],
): Float64Array[] {
  return data.x.map((row) => {
    const out = new Float64Array(FEATURE_COUNT);
    for (let i = 0; i < FEATURE_COUNT; i++) out[i] = (row[i] - mean[i]) / std[i];
    return out;
  });
}

function evaluate(
  layers: Layer[],
  inputs: Float64Array[],
  labels: number[],
): { accuracy: number; confusion: number[][] } {
  const n = SIGNAL_CLASSES.length;
  const confusion = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  let correct = 0;
  for (let i = 0; i < inputs.length; i++) {
    const logits = forwardPass(layers, inputs[i]);
    const predicted = argmax(logits);
    confusion[labels[i]][predicted]++;
    if (predicted === labels[i]) correct++;
  }
  return {
    accuracy: inputs.length > 0 ? correct / inputs.length : 0,
    confusion,
  };
}

function printConfusion(confusion: number[][]): void {
  const names = SIGNAL_CLASSES;
  const width = 8;
  const pad = (s: string) => s.padStart(width);
  console.log("\n  actual \\ predicted");
  console.log("  " + pad("") + names.map((c) => pad(c.slice(0, 7))).join(""));
  for (let i = 0; i < names.length; i++) {
    const row = confusion[i];
    const total = row.reduce((a, b) => a + b, 0) || 1;
    const cells = row
      .map((v, j) => {
        const text = v === 0 ? "·" : String(v);
        return pad(i === j ? `[${text}]` : text);
      })
      .join("");
    const recall = ((row[i] / total) * 100).toFixed(0);
    console.log("  " + pad(names[i]) + cells + `   ${recall}%`);
  }
}

function printPerClass(confusion: number[][]): void {
  console.log("\n  class      precision  recall");
  for (let i = 0; i < SIGNAL_CLASSES.length; i++) {
    const tp = confusion[i][i];
    let predictedTotal = 0;
    for (let r = 0; r < confusion.length; r++) predictedTotal += confusion[r][i];
    const actualTotal = confusion[i].reduce((a, b) => a + b, 0);
    const precision = predictedTotal > 0 ? tp / predictedTotal : 0;
    const recall = actualTotal > 0 ? tp / actualTotal : 0;
    console.log(
      `  ${SIGNAL_CLASSES[i].padEnd(10)} ${(precision * 100).toFixed(1).padStart(8)}% ${(recall * 100).toFixed(1).padStart(7)}%`,
    );
  }
}

function arg(name: string, fallback: number): number {
  const flag = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(flag));
  if (!found) return fallback;
  const value = Number(found.slice(flag.length));
  return Number.isFinite(value) ? value : fallback;
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

async function main(): Promise<void> {
  const perClass = arg("per-class", 2800);
  const frames = arg("frames", 18);
  const epochs = arg("epochs", 120);
  const seed = arg("seed", 20260805);
  const batchSize = 64;

  console.log("SDRSense — signal identification model");
  console.log(
    `  classes=${SIGNAL_CLASSES.length} features=${FEATURE_COUNT} hidden=[${HIDDEN}]`,
  );
  console.log(`  synthesising ${perClass} examples/class × ${frames} frames…`);

  const startedAt = Date.now();
  let lastLogged = 0;
  const data = buildDataset({
    perClass,
    frames,
    seed,
    onProgress: (done, total) => {
      const pct = Math.floor((done / total) * 100);
      if (pct >= lastLogged + 10) {
        lastLogged = pct;
        process.stdout.write(`  ${pct}%…\n`);
      }
    },
  });
  console.log(
    `  built ${data.x.length} examples in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
  );

  const rng = new Rng(seed ^ 0x5f3759df);
  shuffle(data, rng);
  const [train, test] = split(data, 0.15);
  const { mean, std } = standardisation(train);

  const trainX = standardise(train, mean, std);
  const testX = standardise(test, mean, std);

  const sizes = [FEATURE_COUNT, ...HIDDEN, SIGNAL_CLASSES.length];
  const layers: Layer[] = [];
  for (let i = 0; i < sizes.length - 1; i++) {
    layers.push(makeLayer(sizes[i], sizes[i + 1], i < sizes.length - 2, rng));
  }

  console.log(`  training on ${trainX.length}, holding out ${testX.length}\n`);

  let step = 0;
  let bestAccuracy = 0;
  let bestSnapshot = snapshot(layers);
  const order = trainX.map((_, i) => i);

  for (let epoch = 1; epoch <= epochs; epoch++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    // Cosine decay keeps late epochs from bouncing around the minimum.
    const lr = 0.004 * (0.5 * (1 + Math.cos((Math.PI * (epoch - 1)) / epochs)));
    let loss = 0;

    for (let start = 0; start < order.length; start += batchSize) {
      const end = Math.min(start + batchSize, order.length);
      for (let k = start; k < end; k++) {
        const index = order[k];
        const logits = forwardPass(layers, trainX[index]);
        const probs = softmax(Float32Array.from(logits));
        const wide = Float64Array.from(probs);
        loss += -Math.log(Math.max(wide[train.y[index]], 1e-12));
        backwardPass(layers, trainX[index], wide, train.y[index]);
      }
      step++;
      adamStep(layers, lr, step, end - start, 1e-5);
    }

    if (epoch % 10 === 0 || epoch === epochs) {
      const { accuracy } = evaluate(layers, testX, test.y);
      console.log(
        `  epoch ${String(epoch).padStart(3)}  loss ${(loss / order.length).toFixed(4)}  test ${(accuracy * 100).toFixed(2)}%`,
      );
      if (accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
        bestSnapshot = snapshot(layers);
      }
    }
  }

  restore(layers, bestSnapshot);
  const { accuracy, confusion } = evaluate(layers, testX, test.y);
  printConfusion(confusion);
  printPerClass(confusion);

  const model: ModelWeights = {
    version: 1,
    featureCount: FEATURE_COUNT,
    classes: [...SIGNAL_CLASSES],
    mean: mean.map(round),
    std: std.map(round),
    layers: layers.map(
      (l): LayerWeights => ({
        inSize: l.inSize,
        outSize: l.outSize,
        w: Array.from(l.w, round),
        b: Array.from(l.b, round),
      }),
    ),
    trainedAt: new Date().toISOString(),
    accuracy: Number(accuracy.toFixed(4)),
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(model), "utf8");

  const params = layers.reduce((sum, l) => sum + l.w.length + l.b.length, 0);
  console.log(`\n  held-out accuracy ${(accuracy * 100).toFixed(2)}%  (${params} parameters)`);
  console.log(`  features: ${FEATURE_NAMES.length} inputs`);
  console.log(`  wrote ${OUT_PATH}`);
}

function snapshot(layers: Layer[]): { w: Float64Array; b: Float64Array }[] {
  return layers.map((l) => ({ w: l.w.slice(), b: l.b.slice() }));
}

function restore(layers: Layer[], snap: { w: Float64Array; b: Float64Array }[]): void {
  layers.forEach((l, i) => {
    l.w.set(snap[i].w);
    l.b.set(snap[i].b);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
