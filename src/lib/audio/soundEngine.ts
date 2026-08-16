import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { findSoundDefinition } from './soundLibrary';

export interface SoundLayerMix {
  soundId: string;
  volume: number;
}

interface EngineEntry {
  player: AudioPlayer;
  targetVolume: number;
  rampTimer: ReturnType<typeof setInterval> | null;
}

const RAMP_MS = 500;
const RAMP_STEP_MS = 50;

const layers = new Map<string, EngineEntry>();
let lockScreenOwnerId: string | null = null;

function rampVolume(entry: EngineEntry, target: number) {
  if (entry.rampTimer != null) clearInterval(entry.rampTimer);
  const clampedTarget = Math.min(1, Math.max(0, target));
  const steps = Math.max(1, Math.round(RAMP_MS / RAMP_STEP_MS));
  const start = entry.player.volume;
  const delta = (clampedTarget - start) / steps;
  let step = 0;

  entry.rampTimer = setInterval(() => {
    step += 1;
    entry.player.volume = step >= steps ? clampedTarget : start + delta * step;
    if (step >= steps) {
      clearInterval(entry.rampTimer!);
      entry.rampTimer = null;
    }
  }, RAMP_STEP_MS);

  entry.targetVolume = clampedTarget;
}

/**
 * Exactly one player owns lock-screen/background-session activation, and that ownership
 * is sticky — it changes only when the current owner's layer is removed from the mix,
 * never on volume changes or new layers being added alongside an existing owner.
 */
function reassignLockScreenOwnerIfNeeded() {
  if (lockScreenOwnerId != null && layers.has(lockScreenOwnerId)) return;

  let bestId: string | null = null;
  let bestVolume = -1;
  for (const id of [...layers.keys()].sort()) {
    const entry = layers.get(id)!;
    if (entry.targetVolume > bestVolume) {
      bestVolume = entry.targetVolume;
      bestId = id;
    }
  }

  if (bestId == null) {
    lockScreenOwnerId = null;
    return;
  }

  layers.get(bestId)!.player.setActiveForLockScreen(true, { title: 'FocusRitual', artist: 'Ambient mix' });
  lockScreenOwnerId = bestId;
}

/** Reconciles the active player pool against the desired mix. */
export function setMix(mix: SoundLayerMix[]) {
  const nextIds = new Set(mix.map((m) => m.soundId));

  for (const [soundId, entry] of [...layers.entries()]) {
    if (nextIds.has(soundId)) continue;
    if (entry.rampTimer != null) clearInterval(entry.rampTimer);
    entry.player.pause();
    entry.player.remove();
    layers.delete(soundId);
  }

  for (const { soundId, volume } of mix) {
    const definition = findSoundDefinition(soundId);
    if (!definition) continue;

    let entry = layers.get(soundId);
    if (!entry) {
      const player = createAudioPlayer(definition.source);
      player.loop = true;
      player.volume = 0;
      entry = { player, targetVolume: 0, rampTimer: null };
      layers.set(soundId, entry);
    }
    rampVolume(entry, volume);
  }

  reassignLockScreenOwnerIfNeeded();
}

export function setLayerVolume(soundId: string, volume: number) {
  const entry = layers.get(soundId);
  if (!entry) return;
  rampVolume(entry, volume);
}

/** Syncs with the timer's run state by default; independent of per-layer volume changes. */
export function play() {
  for (const entry of layers.values()) entry.player.play();
}

export function pause() {
  for (const entry of layers.values()) entry.player.pause();
}

/** App teardown — every player must be released, not just paused. */
export function dispose() {
  for (const entry of layers.values()) {
    if (entry.rampTimer != null) clearInterval(entry.rampTimer);
    entry.player.pause();
    entry.player.remove();
  }
  layers.clear();
  lockScreenOwnerId = null;
}
