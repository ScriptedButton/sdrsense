# SDRSense

Browser-native SDR receiver for RTL-SDR v4 (and other RTL2832U + R820/828 sticks) using WebUSB. Tune, demodulate, and watch spectrum/waterfall entirely in Chromium — no native drivers.

## Requirements

- Chromium-based browser (Chrome, Edge, Opera)
- HTTPS or `localhost` (WebUSB secure context)
- RTL-SDR v4 (or compatible) USB stick
- On Linux: may need udev rules / unload `dvb_usb_rtl28xxu` so WebUSB can claim the device

## Develop

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), then **Connect** your stick or use **Demo** to explore without hardware.

## Features

- WebUSB connect to RTL-SDR
- Live spectrum scope + waterfall
- Demodulation: WBFM, NBFM, AM, USB, LSB, CW
- Frequency, offset, gain (AGC/manual), volume, bandwidth, squelch / auto-squelch
- Band presets and demo mode with simulated signals
- GMRS channel presets (1–22 + repeater inputs) and GMRS callsign lookup (FCC via Skywave)
- Live transcription of demodulated audio (Whisper tiny.en, in-browser)
- Morse / CW decoder on demod audio — tone or envelope detection, fixed or auto WPM, with keyword / Q-code / callsign identification
- Callsign lookup — amateur (HamDB + Callook) or GMRS (Skywave / FCC); click a callsign in Morse decode to open it
- FSK / RTTY decoder (Baudot & ASCII) on demod audio — discriminator or AFSK tones
- Weatherfax (HF fax) decoder on USB/LSB audio — IOC 576/288, LPM 120/60, APT sync, progressive chart + PNG export; USCG station schedule/map with auto-tune and HF reachability
- FT8 decoder on USB/LSB demod audio (UTC 15 s periods, powered by `@e04/ft8ts`)
- P25 Phase 1 trunk + voice — C4FM from IQ, control-channel follow (single dongle), clear IMBE playback; encrypted calls muted
- ML signal identification — scans the tuned window and classifies each signal's modulation

Powered by [`@jtarrio/webrtlsdr`](https://github.com/jtarrio/webrtlsdr) and [`@jtarrio/signals`](https://github.com/jtarrio/signals).

### P25 / IMBE patent notice

P25 clear-voice synthesis uses a WebAssembly build of [mbelib](https://github.com/szechyjs/mbelib) (educational IMBE/AMBE primitives). Executable objects derived from that package may be covered by patents; check licensing before redistributing binaries. Metadata decode (NAC, talkgroups, grants) does not require the vocoder.

## Signal identification

**Scan band** finds every emission above the noise floor in the current RF
window, classifies how each one is modulated, and matches it against a
SigID-wiki-derived catalog so common services get a real name (NOAA Weather
Radio, ADS-B, POCSAG, APRS, …) rather than only a modulation label.

Modulation classes: `CW`, `CARRIER`, `AM`, `USB`, `LSB`, `NBFM`, `WBFM`,
`FSK`, `DIGITAL`, or `NOISE`. Results list bandwidth, SNR, confidence, and any
catalog hits (with a link to [sigidwiki.com](https://www.sigidwiki.com)).
Selecting one tunes it and switches the demodulator to match.

Detection is ordinary DSP — a robust noise floor estimate plus hysteresis band
segmentation. Classification is a small neural network (44 inputs, two hidden
layers, ~5k parameters) that runs on-device with no model download. Naming uses parametric
matching: frequency allocation × occupied bandwidth × modulation class against
the bundled catalog (same approach as Artemis / SigID wiki offline browsers).

### Retraining the model

There is no public pretrained RF modulation classifier that runs in a browser,
so the model ships trained from synthetic signals generated in this repo:

```bash
pnpm train:signal-id
```

This synthesises labelled IQ for each class, transforms it with the same
Blackman window and 2048-point FFT the live receiver uses, runs the result
through the *same* detector and feature extractor the browser runs, trains an
MLP, and writes `lib/sdr/signal-id/model-weights.json`. It prints a confusion
matrix and held-out accuracy. Useful flags: `--per-class`, `--frames`,
`--epochs`, `--seed`.

### Refreshing the signal catalog

The app ships with a curated seed of common RTL-SDR signals. To rebuild from
the live Signal Identification Wiki (when reachable):

```bash
pnpm fetch:signal-catalog
```

That writes `lib/sdr/signal-id/catalog/signals.json`. The matcher prefers the
fetched dump when it contains more entries than the curated seed.

Sharing the feature code between training and inference is deliberate — it is
what keeps synthetic training data faithful to live hardware. Every feature is
computed relative to the noise floor or the peak rather than from absolute dB,
so classification is unaffected by gain and AGC settings.

Two limits worth knowing. At 500 Hz per FFT bin, upper and lower sideband differ
only by which way the voice energy tapers across a handful of bins; when the
model cannot separate them it reports `SSB` rather than guessing. And a Morse
signal that happens to stay keyed down for the whole observation window is
genuinely a carrier, so some `CW`/`CARRIER` confusion is inherent rather than
a modelling failure.
