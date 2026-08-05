/**
 * Offline FT8 encode → decode smoke test.
 * Run: pnpm exec tsx scripts/ft8-smoke.ts
 */
import { decodeFT8, encodeFT8, HashCallBook } from "@e04/ft8ts";

import { extractFt8Symbols } from "../lib/sdr/ft8/symbols";
import { FT8_DECODE_RATE } from "../lib/sdr/ft8/types";

const MSG = "CQ K1ABC FN42";
const BASE = 1500;
const SR = FT8_DECODE_RATE;

const audio = encodeFT8(MSG, { sampleRate: SR, baseFrequency: BASE });
const book = new HashCallBook();
const direct = decodeFT8(audio, {
  sampleRate: SR,
  depth: 2,
  hashCallBook: book,
});

console.log("direct encode→decode:");
for (const d of direct) {
  console.log(`  ${d.msg}  SNR ${d.snr.toFixed(1)}  ${d.freq.toFixed(0)} Hz`);
}

const symbols = extractFt8Symbols(MSG, BASE);
const rebuilt = new Float32Array(Math.floor(15 * SR));
let phase = 0;
const spSym = Math.floor(SR * 0.16);
for (let i = 0; i < Math.floor(12.64 * SR); i++) {
  const sym = symbols[Math.min(Math.floor(i / spSym), symbols.length - 1)]!;
  const f = BASE + sym * 6.25;
  phase += (2 * Math.PI * f) / SR;
  rebuilt[i] = 0.5 * Math.sin(phase);
}

const fromSymbols = decodeFT8(rebuilt, {
  sampleRate: SR,
  depth: 2,
  hashCallBook: new HashCallBook(),
});

console.log("symbol-rebuild→decode:");
for (const d of fromSymbols) {
  console.log(`  ${d.msg}  SNR ${d.snr.toFixed(1)}  ${d.freq.toFixed(0)} Hz`);
}

const ok =
  direct.some((d) => d.msg.includes("K1ABC")) &&
  fromSymbols.some((d) => d.msg.includes("K1ABC"));

if (!ok) {
  console.error("FAIL: expected CQ K1ABC in both paths");
  process.exit(1);
}
console.log("OK");
