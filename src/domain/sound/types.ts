/** The minimal surface a real AudioPlayer (or a test fake) must expose. */
export interface EnginePlayer {
  volume: number;
  loop: boolean;
  play(): void;
  pause(): void;
  remove(): void;
  setActiveForLockScreen(active: boolean, options?: { title: string; artist: string }): void;
}

export interface SoundLayerMix {
  soundId: string;
  /** Already the effective (layer × master) volume the player should ramp to. */
  volume: number;
}

export interface SoundEngineOptions {
  /** Returns null for an unknown soundId — the engine skips it rather than creating a dangling entry. */
  createPlayer: (soundId: string) => EnginePlayer | null;
  rampMs?: number;
  rampStepMs?: number;
}

export interface SoundEngine {
  /** Reconciles the active player pool against the desired mix — additions ramp in, removals fade out then release. */
  setMix(mix: SoundLayerMix[]): void;
  setLayerVolume(soundId: string, volume: number): void;
  play(): void;
  pause(): void;
  /** Releases every player immediately — app teardown only, not a normal mix change. */
  dispose(): void;
  getActiveLayerIds(): string[];
  getLockScreenOwnerId(): string | null;
}
