import type { Player } from "@jtarrio/signals/demod/player.js";
import { AudioPlayer } from "@jtarrio/signals/players/audioplayer.js";

import { mixToMono } from "./audio-utils";

export type AudioTapListener = (mono: Float32Array, sampleRate: number) => void;

/**
 * Plays demodulated audio and optionally forwards mono PCM to listeners
 * (used for live transcription).
 */
export class TappingPlayer implements Player {
  private readonly inner = new AudioPlayer();
  private listeners = new Set<AudioTapListener>();
  private tapping = false;

  get sampleRate(): number {
    return this.inner.sampleRate;
  }

  setVolume(volume: number): void {
    this.inner.setVolume(volume);
  }

  getVolume(): number {
    return this.inner.getVolume();
  }

  play(left: Float32Array, right: Float32Array): void {
    this.inner.play(left, right);
    if (!this.tapping || this.listeners.size === 0) return;
    const mono = mixToMono(left, right);
    const rate = this.inner.sampleRate;
    for (const listener of this.listeners) {
      listener(mono, rate);
    }
  }

  setTapping(enabled: boolean): void {
    this.tapping = enabled;
  }

  isTapping(): boolean {
    return this.tapping;
  }

  onAudio(listener: AudioTapListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
