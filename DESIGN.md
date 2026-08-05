/**
 * Visual system for SDRSense.
 *
 * Mood: radar operations desk — charcoal glass, rose armed-status, cyan RF traces.
 * Strategy: Restrained product — neutrals dominate; rose for primary actions; cyan for signal data.
 */

## Theme
dark (near-black canvas for spectrum readability)

## Colors
- bg: oklch(0.10 0 0)
- surface: oklch(0.14 0 0)
- surface-2: oklch(0.17 0 0)
- canvas: oklch(0.08 0 0)
- ink: oklch(0.93 0.01 355)
- muted: oklch(0.62 0.015 355)
- line: oklch(0.28 0.01 355)
- primary: oklch(0.60 0.19 355) — rose CTAs
- accent: oklch(0.78 0.12 195) — cyan RF / status
- danger: oklch(0.68 0.18 25)
- warn: oklch(0.80 0.14 75)

## Typography
- UI: IBM Plex Sans
- Data / frequency: IBM Plex Mono
- Scale: tight product scale (text-xs → text-xl)

## Components
- Primary button: filled rose, white label
- Secondary: surface-2 + line border
- Mode chips / presets: outline, active uses primary or accent tint
- Sliders: line track, cyan thumb
- Spectrum/waterfall: full-bleed canvas panes, markers for center + demod offset

## Layout
- Top bar: brand + hero VFO (digit display) + Connect / Demo / Stop
- Primary toolbar: mode chips · volume · band presets (always visible)
- Main: Scope (spectrum over waterfall) or full-bleed 3D spectrometer — toggle in pane header
- Right rail (~22rem), tabbed: Radio (freq detail, BW/squelch/offset, sample rate, audio/RF, presets, setup) · Decode (Morse / FSK / FT8 / Speech) · Identify (signal ID)
- Bottom status strip: tune / center / mode / rate
- Empty spectrum: Connect + Demo CTAs inline

## Displays
- Scope: 2D spectrum + scrolling waterfall
- Waterfall options: palette (cubehelix / thermal / viridis / ocean / mono), speed, newest top/bottom, contrast (shared dB range with scope)
- Frequency: digit VFO (click place · scroll/↑↓ nudge), Tune vs Center target, Auto/MHz/kHz/Hz format — prefs persist in localStorage
- Spectrum nav: click tune · drag pan · scroll zoom · double-click center
- Spectrum width: sample-rate presets (0.25–2.88 MHz)
- 3D spectrometer: frequency × time × power heightmap; orbit / zoom / click-to-tune
