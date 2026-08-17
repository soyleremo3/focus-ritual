import type { EnginePlayer, SoundEngine, SoundEngineOptions, SoundLayerMix } from './types';

const DEFAULT_RAMP_MS = 500;
const DEFAULT_RAMP_STEP_MS = 50;

export function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume));
}

export function effectiveVolume(layerVolume: number, masterVolume: number): number {
  return clampVolume(layerVolume * masterVolume);
}

/**
 * Sticky lock-screen/background-session ownership: keeps the current owner as long as its
 * layer is still present, and only picks a new one (highest current volume, lowest id as a
 * deterministic tie-break) when the owner's layer has been removed. Reassignment must never
 * happen on a volume change or a new layer joining an already-owned mix.
 */
export function selectLockScreenOwner(
  layers: { id: string; volume: number }[],
  currentOwnerId: string | null
): string | null {
  if (currentOwnerId != null && layers.some((l) => l.id === currentOwnerId)) return currentOwnerId;

  let bestId: string | null = null;
  let bestVolume = -1;
  for (const { id, volume } of [...layers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (volume > bestVolume) {
      bestVolume = volume;
      bestId = id;
    }
  }
  return bestId;
}

interface Entry {
  player: EnginePlayer;
  targetVolume: number;
  rampTimer: ReturnType<typeof setInterval> | null;
  /** Set while fading out toward removal — cancelled if the layer reappears in setMix() before it fires. */
  removalTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Framework-independent sound engine core: no expo-audio import, just the EnginePlayer
 * interface, so it can be unit-tested with a fake player and fake timers. The real
 * lib/audio/soundEngine.ts wraps this with expo-audio's createAudioPlayer.
 */
export function createSoundEngine(options: SoundEngineOptions): SoundEngine {
  const rampMs = options.rampMs ?? DEFAULT_RAMP_MS;
  const rampStepMs = options.rampStepMs ?? DEFAULT_RAMP_STEP_MS;
  const createPlayer = options.createPlayer;

  const layers = new Map<string, Entry>();
  let lockScreenOwnerId: string | null = null;

  function clearRamp(entry: Entry) {
    if (entry.rampTimer != null) {
      clearInterval(entry.rampTimer);
      entry.rampTimer = null;
    }
  }

  function clearRemoval(entry: Entry) {
    if (entry.removalTimer != null) {
      clearTimeout(entry.removalTimer);
      entry.removalTimer = null;
    }
  }

  function rampVolume(entry: Entry, target: number) {
    clearRamp(entry);
    const clamped = clampVolume(target);
    const steps = Math.max(1, Math.round(rampMs / rampStepMs));
    const start = entry.player.volume;
    const delta = (clamped - start) / steps;
    let step = 0;
    entry.targetVolume = clamped;

    entry.rampTimer = setInterval(() => {
      step += 1;
      entry.player.volume = step >= steps ? clamped : start + delta * step;
      if (step >= steps) clearRamp(entry);
    }, rampStepMs);
  }

  function reassignLockScreenOwnerIfNeeded() {
    const candidates = [...layers.entries()].map(([id, entry]) => ({ id, volume: entry.targetVolume }));
    const nextOwner = selectLockScreenOwner(candidates, lockScreenOwnerId);
    if (nextOwner == null) {
      lockScreenOwnerId = null;
      return;
    }
    if (nextOwner !== lockScreenOwnerId) {
      const { player } = layers.get(nextOwner)!;
      // Real bug caught on-device via Expo Go: this method is declared on expo-audio's
      // AudioPlayer type but was `undefined` at runtime — calling it unconditionally threw
      // synchronously from inside a Pressable's onPress handler (toggling a sound layer),
      // which React error boundaries can't catch since it's outside the render phase.
      player.setActiveForLockScreen?.(true, { title: 'FocusRitual', artist: 'Ambient mix' });
    }
    lockScreenOwnerId = nextOwner;
  }

  function finalizeRemoval(soundId: string) {
    const entry = layers.get(soundId);
    if (!entry) return;
    clearRamp(entry);
    entry.player.pause();
    entry.player.remove();
    layers.delete(soundId);
    reassignLockScreenOwnerIfNeeded();
  }

  function scheduleRemoval(soundId: string) {
    const entry = layers.get(soundId);
    if (!entry) return;
    clearRemoval(entry);
    rampVolume(entry, 0);
    entry.removalTimer = setTimeout(() => finalizeRemoval(soundId), rampMs + rampStepMs);
  }

  return {
    setMix(mix: SoundLayerMix[]) {
      const nextIds = new Set(mix.map((m) => m.soundId));

      for (const [soundId, entry] of layers) {
        if (nextIds.has(soundId) || entry.removalTimer != null) continue;
        scheduleRemoval(soundId);
      }

      for (const { soundId, volume } of mix) {
        const existing = layers.get(soundId);
        if (existing) {
          // Reappearing mid-fade-out — cancel the pending removal and ramp back up on the
          // same player instance instead of creating a duplicate.
          clearRemoval(existing);
          rampVolume(existing, volume);
          continue;
        }

        const player = createPlayer(soundId);
        if (!player) continue;
        player.loop = true;
        player.volume = 0;
        const entry: Entry = { player, targetVolume: 0, rampTimer: null, removalTimer: null };
        layers.set(soundId, entry);
        rampVolume(entry, volume);
      }

      reassignLockScreenOwnerIfNeeded();
    },

    setLayerVolume(soundId: string, volume: number) {
      const entry = layers.get(soundId);
      if (!entry) return;
      clearRemoval(entry);
      rampVolume(entry, volume);
    },

    play() {
      for (const entry of layers.values()) entry.player.play();
    },

    pause() {
      for (const entry of layers.values()) entry.player.pause();
    },

    dispose() {
      for (const entry of layers.values()) {
        clearRamp(entry);
        clearRemoval(entry);
        entry.player.pause();
        entry.player.remove();
      }
      layers.clear();
      lockScreenOwnerId = null;
    },

    getActiveLayerIds() {
      return [...layers.keys()];
    },

    getLockScreenOwnerId() {
      return lockScreenOwnerId;
    },
  };
}
