"use client";

import {
  keywordKindLabel,
  type MorseKeywordHit,
  type MorseKeywordKind,
} from "@/lib/sdr/morse/keywords";

type MorseKeywordChipsProps = {
  keywords: MorseKeywordHit[];
};

const KIND_CLASS: Record<MorseKeywordKind, string> = {
  procedure: "morse-kw-procedure",
  qcode: "morse-kw-qcode",
  prosign: "morse-kw-prosign",
  callsign: "morse-kw-callsign",
};

export function MorseKeywordChips({ keywords }: MorseKeywordChipsProps) {
  if (keywords.length === 0) return null;

  return (
    <ul className="morse-kw-chips" aria-label="Identified Morse keywords">
      {keywords.map((kw) => (
        <li key={`${kw.token}-${kw.index}`}>
          <span
            className={`morse-kw-chip ${KIND_CLASS[kw.kind]}`}
            title={`${keywordKindLabel(kw.kind)} · ${kw.meaning}`}
          >
            <span className="morse-kw-chip-token">{kw.token}</span>
            <span className="morse-kw-chip-meaning">{kw.meaning}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
