/**
 * Offline smoke test: encode Morse → keyed 600 Hz PCM → decode.
 * Run: pnpm exec tsx scripts/morse-smoke.ts
 */
import { encodeMorseUnits } from "../lib/sdr/morse/alphabet";
import { MorseDecoder } from "../lib/sdr/morse/decoder";
import { DEFAULT_MORSE_CONFIG, ditSeconds } from "../lib/sdr/morse/types";

const MESSAGE = "CQ DE SDRSENSE K";
const WPM = 20;
const RATE = 48_000;
const TONE_HZ = 600;
const UNITS = encodeMorseUnits(MESSAGE);
const DIT = ditSeconds(WPM);
const SAMPLES_PER_DIT = Math.round(RATE * DIT);
const TOTAL = UNITS.length * SAMPLES_PER_DIT;

const pcm = new Float32Array(TOTAL);
for (let i = 0; i < TOTAL; i++) {
  const idx = Math.floor(i / SAMPLES_PER_DIT);
  if (!UNITS[idx]) continue;
  pcm[i] = 0.4 * Math.sin((2 * Math.PI * TONE_HZ * i) / RATE);
}

const decoder = new MorseDecoder({
  ...DEFAULT_MORSE_CONFIG,
  wpm: WPM,
  toneHz: TONE_HZ,
  autoSpeed: false,
});
const { chars, lock, wpmEstimate } = decoder.push(pcm, RATE);

const normalized = (s: string) => s.replace(/\s+/g, " ").trim();
const got = normalized(chars);
const want = normalized(MESSAGE);

console.log("want:", JSON.stringify(want));
console.log("got: ", JSON.stringify(got));
console.log("lock:", lock.toFixed(3), "wpm:", wpmEstimate.toFixed(1));

if (!got.includes("CQ") || !got.includes("SDRSENSE")) {
  console.error("FAIL: expected message fragments missing");
  process.exit(1);
}
console.log("OK");
