"use client";

import { useRadioController } from "@/components/sdr/sdr-provider";
import { wefaxTuneHz } from "@/lib/sdr/wefax/stations";

const WEFAX_USB_BANDWIDTH_HZ = 2_900;

/** Tune USB to a radiofax assigned frequency and optionally start decode. */
export function useTuneWefax() {
  const controller = useRadioController();

  return (assignedHz: number, opts?: { decode?: boolean }) => {
    const tuneHz = wefaxTuneHz(assignedHz);
    controller.setScheme("USB");
    controller.setBandwidth(WEFAX_USB_BANDWIDTH_HZ);
    void controller.setFrequency(tuneHz);
    controller.setOffset(0);
    controller.setWefaxPreset("ioc576-120");
    if (opts?.decode) controller.setWefaxEnabled(true);
  };
}
