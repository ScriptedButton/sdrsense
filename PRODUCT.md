# Product

## Register

product

## Users

Hobbyists, ham operators, and RF tinkerers with an RTL-SDR v4 stick. They plug in USB, open a Chromium browser, and want to tune, listen, and see spectrum without installing native SDR software.

## Product Purpose

SDRSense is a browser-native SDR receiver. Connect an RTL-SDR v4 over WebUSB, tune frequency, demodulate (FM / AM / SSB / CW), and watch live spectrum, waterfall, or a 3D spectrometer — all client-side. Success is: connect in one click, hear audio, and see the band clearly within seconds.

## Brand Personality

Precise · Technical · Focused

Instrument tone: short labels, numeric clarity, no marketing fluff. Confidence through quiet competence.

## Anti-references

- Generic dark SaaS dashboards with card grids and hero metrics
- Consumer podcast / music-player UIs
- Dense 1990s ham-radio control panels with unlabeled knobs everywhere
- Purple-glow “AI tool” aesthetics

## Design Principles

- Spectrum first — the display is the product; chrome stays out of the way
- One primary action at a time — connect, then tune/listen
- Numbers you can trust — frequency, mode, and gain always visible and editable
- Failures are actionable — WebUSB, permissions, and device errors say what to do next
- Demo without hardware — explore the UI with a simulated stick

## Accessibility & Inclusion

WCAG 2.1 AA for controls and chrome. Spectrum/waterfall are visual by nature; provide text status (frequency, mode, SNR/stereo, connection state). Honor `prefers-reduced-motion`. Keyboard-reachable controls for tune, play/stop, and mode.
