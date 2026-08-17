import { clampVolume, createSoundEngine, effectiveVolume, selectLockScreenOwner } from '../sound/soundEngine';
import type { EnginePlayer } from '../sound/types';

const RAMP_MS = 100;
const RAMP_STEP_MS = 10;

class FakePlayer implements EnginePlayer {
  volume = 0;
  loop = false;
  playCount = 0;
  pauseCount = 0;
  removeCount = 0;
  lockScreenActive = false;

  play() {
    this.playCount += 1;
  }
  pause() {
    this.pauseCount += 1;
  }
  remove() {
    this.removeCount += 1;
  }
  setActiveForLockScreen(active: boolean) {
    this.lockScreenActive = active;
  }
}

function makeHarness() {
  const players = new Map<string, FakePlayer>();
  const createCounts = new Map<string, number>();
  const createPlayer = (soundId: string): EnginePlayer | null => {
    if (soundId === 'unknown-sound') return null;
    const player = new FakePlayer();
    players.set(soundId, player);
    createCounts.set(soundId, (createCounts.get(soundId) ?? 0) + 1);
    return player;
  };
  const engine = createSoundEngine({ createPlayer, rampMs: RAMP_MS, rampStepMs: RAMP_STEP_MS });
  return { engine, players, createCounts };
}

function settleRamp() {
  jest.advanceTimersByTime(RAMP_MS + RAMP_STEP_MS);
}

function settleRemoval() {
  // scheduleRemoval waits rampMs+rampStepMs for the fade, then its own rampMs+rampStepMs timeout.
  jest.advanceTimersByTime(2 * (RAMP_MS + RAMP_STEP_MS));
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('clampVolume / effectiveVolume', () => {
  test('clamps below 0 and above 1', () => {
    expect(clampVolume(-0.5)).toBe(0);
    expect(clampVolume(1.5)).toBe(1);
    expect(clampVolume(0.4)).toBe(0.4);
  });

  test('effectiveVolume multiplies and clamps', () => {
    expect(effectiveVolume(0.5, 0.5)).toBe(0.25);
    expect(effectiveVolume(1, 1)).toBe(1);
    expect(effectiveVolume(0.9, 0)).toBe(0);
  });
});

describe('selectLockScreenOwner', () => {
  test('picks the highest-volume layer', () => {
    const owner = selectLockScreenOwner(
      [
        { id: 'rain', volume: 0.3 },
        { id: 'wind', volume: 0.7 },
      ],
      null
    );
    expect(owner).toBe('wind');
  });

  test('ties break on the lowest id', () => {
    const owner = selectLockScreenOwner(
      [
        { id: 'wind', volume: 0.5 },
        { id: 'rain', volume: 0.5 },
      ],
      null
    );
    expect(owner).toBe('rain');
  });

  test('sticks with the current owner even if no longer the loudest', () => {
    const owner = selectLockScreenOwner(
      [
        { id: 'rain', volume: 0.2 },
        { id: 'wind', volume: 0.9 },
      ],
      'rain'
    );
    expect(owner).toBe('rain');
  });

  test('reassigns once the current owner is no longer present', () => {
    const owner = selectLockScreenOwner([{ id: 'wind', volume: 0.9 }], 'rain');
    expect(owner).toBe('wind');
  });

  test('returns null for an empty layer set', () => {
    expect(selectLockScreenOwner([], 'rain')).toBeNull();
  });
});

describe('createSoundEngine', () => {
  test('setMix creates exactly one player per new layer', () => {
    const { engine, createCounts } = makeHarness();
    engine.setMix([{ soundId: 'rain', volume: 0.6 }]);
    engine.setMix([{ soundId: 'rain', volume: 0.6 }]); // same mix again — must not recreate
    expect(createCounts.get('rain')).toBe(1);
    expect(engine.getActiveLayerIds()).toEqual(['rain']);
  });

  test('adding a layer ramps volume up gradually, not an instant jump', () => {
    const { engine, players } = makeHarness();
    engine.setMix([{ soundId: 'rain', volume: 0.8 }]);
    const player = players.get('rain')!;
    expect(player.volume).toBe(0);
    jest.advanceTimersByTime(RAMP_STEP_MS);
    expect(player.volume).toBeGreaterThan(0);
    expect(player.volume).toBeLessThan(0.8);
    settleRamp();
    expect(player.volume).toBeCloseTo(0.8);
  });

  test('removing a layer fades out before releasing it — not an instant cut', () => {
    const { engine, players } = makeHarness();
    engine.setMix([{ soundId: 'rain', volume: 0.8 }]);
    settleRamp();
    const player = players.get('rain')!;

    engine.setMix([]);
    // Still present immediately after — the removal is scheduled, not synchronous.
    expect(engine.getActiveLayerIds()).toEqual(['rain']);
    expect(player.removeCount).toBe(0);

    jest.advanceTimersByTime(RAMP_STEP_MS);
    expect(player.volume).toBeGreaterThan(0);
    expect(player.volume).toBeLessThan(0.8);

    settleRemoval();
    expect(player.volume).toBe(0);
    expect(player.removeCount).toBe(1);
    expect(engine.getActiveLayerIds()).toEqual([]);
  });

  test('re-adding a layer mid-fade-out cancels the removal and reuses the same player', () => {
    const { engine, players, createCounts } = makeHarness();
    engine.setMix([{ soundId: 'rain', volume: 0.8 }]);
    settleRamp();

    engine.setMix([]); // start fading out
    jest.advanceTimersByTime(RAMP_STEP_MS); // mid-fade
    engine.setMix([{ soundId: 'rain', volume: 0.5 }]); // re-added before removal fires

    // No duplicate player created, and the original was never removed.
    expect(createCounts.get('rain')).toBe(1);
    const player = players.get('rain')!;
    expect(player.removeCount).toBe(0);

    // Advancing past when the (cancelled) removal would have fired must not remove it.
    settleRemoval();
    expect(player.removeCount).toBe(0);
    expect(engine.getActiveLayerIds()).toEqual(['rain']);

    settleRamp();
    expect(player.volume).toBeCloseTo(0.5);
  });

  test('rapid add/remove/add cycles leave no leaked players and match the final desired mix', () => {
    const { engine, players, createCounts } = makeHarness();
    engine.setMix([{ soundId: 'rain', volume: 0.5 }]);
    engine.setMix([]);
    engine.setMix([{ soundId: 'rain', volume: 0.5 }]);
    engine.setMix([]);
    engine.setMix([{ soundId: 'rain', volume: 0.9 }, { soundId: 'wind', volume: 0.4 }]);

    settleRemoval();
    settleRamp();

    expect(createCounts.get('rain')).toBe(1);
    expect(createCounts.get('wind')).toBe(1);
    expect(engine.getActiveLayerIds().sort()).toEqual(['rain', 'wind']);
    expect(players.get('rain')!.removeCount).toBe(0);
  });

  test('an unknown soundId is skipped, not left as a dangling entry', () => {
    const { engine } = makeHarness();
    engine.setMix([{ soundId: 'unknown-sound', volume: 0.5 }, { soundId: 'rain', volume: 0.5 }]);
    expect(engine.getActiveLayerIds()).toEqual(['rain']);
  });

  test('lock-screen ownership is sticky and only reassigns when the owner is removed', () => {
    const { engine, players } = makeHarness();
    engine.setMix([{ soundId: 'rain', volume: 0.3 }, { soundId: 'wind', volume: 0.7 }]);
    expect(engine.getLockScreenOwnerId()).toBe('wind');
    expect(players.get('wind')!.lockScreenActive).toBe(true);

    // A louder layer joins — ownership must not jump to it.
    engine.setMix([
      { soundId: 'rain', volume: 0.3 },
      { soundId: 'wind', volume: 0.7 },
      { soundId: 'fireplace', volume: 0.95 },
    ]);
    expect(engine.getLockScreenOwnerId()).toBe('wind');

    // Owner's layer is removed — reassigns to the next-best.
    engine.setMix([{ soundId: 'rain', volume: 0.3 }, { soundId: 'fireplace', volume: 0.95 }]);
    settleRemoval();
    expect(engine.getLockScreenOwnerId()).toBe('fireplace');
  });

  test('reassigning lock-screen ownership never throws when the player lacks setActiveForLockScreen', () => {
    // Real bug caught on-device: expo-audio's AudioPlayer type declares this method but it
    // was `undefined` at runtime. A fake player without it must not crash setMix().
    class NoLockScreenPlayer implements EnginePlayer {
      volume = 0;
      loop = false;
      play() {}
      pause() {}
      remove() {}
      // setActiveForLockScreen intentionally omitted — matches the real-device gap.
    }
    const engine = createSoundEngine({
      createPlayer: () => new NoLockScreenPlayer(),
      rampMs: RAMP_MS,
      rampStepMs: RAMP_STEP_MS,
    });

    expect(() => engine.setMix([{ soundId: 'rain', volume: 0.5 }])).not.toThrow();
    expect(engine.getLockScreenOwnerId()).toBe('rain');
  });

  test('dispose releases every player and clears state', () => {
    const { engine, players } = makeHarness();
    engine.setMix([{ soundId: 'rain', volume: 0.5 }, { soundId: 'wind', volume: 0.5 }]);
    engine.dispose();

    expect(players.get('rain')!.removeCount).toBe(1);
    expect(players.get('wind')!.removeCount).toBe(1);
    expect(engine.getActiveLayerIds()).toEqual([]);
    expect(engine.getLockScreenOwnerId()).toBeNull();
  });

  test('play/pause fan out to every active player', () => {
    const { engine, players } = makeHarness();
    engine.setMix([{ soundId: 'rain', volume: 0.5 }, { soundId: 'wind', volume: 0.5 }]);
    engine.play();
    engine.pause();
    expect(players.get('rain')!.playCount).toBe(1);
    expect(players.get('rain')!.pauseCount).toBe(1);
    expect(players.get('wind')!.playCount).toBe(1);
    expect(players.get('wind')!.pauseCount).toBe(1);
  });
});
