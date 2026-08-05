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
- Top bar: brand + connect
- Main: Scope (spectrum over waterfall) or full-bleed 3D spectrometer — toggle in pane header
- Right rail (~20rem): frequency, mode, audio/RF, presets, setup help
- Bottom status strip: tune / center / mode / rate

## Displays
- Scope: 2D spectrum + scrolling waterfall (cubehelix)
- 3D spectrometer: frequency × time × power heightmap (same palette); orbit / zoom / click-to-tune
