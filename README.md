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
- Frequency, offset, gain (AGC/manual), volume, bandwidth, squelch
- Band presets and demo mode with simulated signals
- Live transcription of demodulated audio (Whisper tiny.en, in-browser)

Powered by [`@jtarrio/webrtlsdr`](https://github.com/jtarrio/webrtlsdr) and [`@jtarrio/signals`](https://github.com/jtarrio/signals).
