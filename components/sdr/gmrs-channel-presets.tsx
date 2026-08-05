"use client";

import { useRadioController, useSdrState } from "@/components/sdr/sdr-provider";
import {
  formatGmrsMhz,
  GMRS_REPEATER_INPUTS,
  GMRS_SIMPLEX_CHANNELS,
  type GmrsChannel,
} from "@/lib/sdr/gmrs/channels";

function ChannelChip({ channel }: { channel: GmrsChannel }) {
  const controller = useRadioController();
  const state = useSdrState();
  const active =
    Math.abs(state.frequencyHz - channel.frequencyHz) < 500 &&
    state.scheme === "NBFM";

  return (
    <button
      type="button"
      className={`preset-chip ${active ? "preset-chip-active" : ""}`}
      title={`GMRS ${channel.channel} · ${formatGmrsMhz(channel.frequencyHz)} MHz`}
      onClick={() => {
        controller.setScheme("NBFM");
        void controller.setFrequency(channel.frequencyHz);
        controller.setOffset(0);
      }}
    >
      {channel.label}
    </button>
  );
}

/** GMRS / FRS channel grid for the Radio rail. */
export function GmrsChannelPresets() {
  return (
    <fieldset className="control-group">
      <legend className="control-label">GMRS channels</legend>
      <p className="mb-2 text-[0.65rem] leading-relaxed text-muted">
        Channels 1–22 shared with FRS · 15R–22R repeater inputs (+5 MHz). NBFM.
      </p>
      <p className="mb-1 text-[0.65rem] font-medium text-muted">1–22</p>
      <div className="flex flex-wrap gap-1">
        {GMRS_SIMPLEX_CHANNELS.map((ch) => (
          <ChannelChip key={ch.id} channel={ch} />
        ))}
      </div>
      <p className="mb-1 mt-2 text-[0.65rem] font-medium text-muted">
        Repeater in
      </p>
      <div className="flex flex-wrap gap-1">
        {GMRS_REPEATER_INPUTS.map((ch) => (
          <ChannelChip key={ch.id} channel={ch} />
        ))}
      </div>
    </fieldset>
  );
}
