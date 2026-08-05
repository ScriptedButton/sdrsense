/**
 * Offline smoke test: synthesize AFSK fax lines → decode → check gradient.
 * Also verifies APT start (300 Hz) triggers phasing in auto sync.
 * Run: pnpm exec tsx scripts/wefax-smoke.ts
 */
import { WefaxDecoder } from "../lib/sdr/wefax/decoder";
import {
  DEFAULT_WEFAX_CONFIG,
  WEFAX_APT_START_IOC576_HZ,
  wefaxLineSeconds,
} from "../lib/sdr/wefax/types";

const RATE = 48_000;
const LINE_SEC = wefaxLineSeconds(120);
const SAMPLES_PER_LINE = Math.round(RATE * LINE_SEC);
const LINES = 8;
const BLACK_HZ = 1500;
const WHITE_HZ = 2300;

// --- Manual imaging gradient ---
{
  const pcm = new Float32Array(SAMPLES_PER_LINE * LINES);
  let phase = 0;
  for (let line = 0; line < LINES; line++) {
    for (let s = 0; s < SAMPLES_PER_LINE; s++) {
      const x = s / SAMPLES_PER_LINE;
      const level = x;
      const freq = BLACK_HZ + level * (WHITE_HZ - BLACK_HZ);
      phase += (2 * Math.PI * freq) / RATE;
      if (phase > Math.PI * 2) phase -= Math.PI * 2;
      pcm[line * SAMPLES_PER_LINE + s] = 0.4 * Math.sin(phase);
    }
  }

  const decoder = new WefaxDecoder({
    ...DEFAULT_WEFAX_CONFIG,
    sync: "manual",
    slantPct: 0,
  });
  decoder.forceStart();
  const result = decoder.push(pcm, RATE);

  console.log("imaging status:", result.status);
  console.log("lines:", result.lines);
  console.log("toneHz:", result.toneHz.toFixed(1));
  console.log("lock:", result.lock.toFixed(3));

  if (result.lines < LINES - 1) {
    console.error(`FAIL: expected ~${LINES} lines, got ${result.lines}`);
    process.exit(1);
  }

  const pixels = decoder.getPixels();
  const width = decoder.getWidth();
  const mid = Math.floor(result.lines / 2);
  const left = avg(pixels, mid * width, 40);
  const right = avg(pixels, mid * width + width - 40, 40);

  console.log("left gray:", left.toFixed(1), "right gray:", right.toFixed(1));

  if (left > 80) {
    console.error("FAIL: left side should be dark (near black)");
    process.exit(1);
  }
  if (right < 170) {
    console.error("FAIL: right side should be bright (near white)");
    process.exit(1);
  }
  if (right - left < 80) {
    console.error("FAIL: gradient contrast too low");
    process.exit(1);
  }
}

// --- APT start detection ---
{
  const secs = 3.2;
  const n = Math.round(RATE * secs);
  const pcm = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    phase += (2 * Math.PI * WEFAX_APT_START_IOC576_HZ) / RATE;
    if (phase > Math.PI * 2) phase -= Math.PI * 2;
    pcm[i] = 0.35 * Math.sin(phase);
  }

  const decoder = new WefaxDecoder({
    ...DEFAULT_WEFAX_CONFIG,
    sync: "auto",
  });
  const chunk = 4096;
  let status = decoder.getStatus();
  for (let i = 0; i < pcm.length; i += chunk) {
    const result = decoder.push(pcm.subarray(i, i + chunk), RATE);
    status = result.status;
  }
  console.log("apt status:", status, "ioc:", decoder.getIoc());
  if (status !== "phasing" && status !== "imaging") {
    console.error("FAIL: APT 300 Hz should enter phasing/imaging");
    process.exit(1);
  }
  if (decoder.getIoc() !== 576) {
    console.error("FAIL: APT 300 Hz should select IOC 576");
    process.exit(1);
  }
}

console.log("OK");

function avg(buf: Uint8Array, start: number, n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += buf[start + i]!;
  return sum / n;
}
