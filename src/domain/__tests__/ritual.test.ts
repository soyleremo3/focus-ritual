import {
  duplicateRitualName,
  isValidRitualName,
  ritualToActiveMix,
  ritualToSessionStart,
  sortRituals,
} from '../ritual/ritual';
import type { Ritual } from '../ritual/types';

const T0 = 1_700_000_000_000;
const DAY = 86_400_000;

function makeRitual(overrides: Partial<Ritual> = {}): Ritual {
  return {
    id: 'r1',
    name: 'Test Ritual',
    timerMode: 'pomodoro',
    focusMinutes: 25,
    breakMinutes: 5,
    cyclesTarget: 4,
    spaceId: 'amber-study',
    soundLayers: [],
    isFavorite: false,
    lastUsedAt: null,
    createdAt: T0,
    isArchived: false,
    ...overrides,
  };
}

describe('isValidRitualName', () => {
  it('accepts a normal name', () => {
    expect(isValidRitualName('Morning Pages')).toBe(true);
  });

  it('rejects empty or whitespace-only names', () => {
    expect(isValidRitualName('')).toBe(false);
    expect(isValidRitualName('   ')).toBe(false);
  });

  it('rejects names over 60 characters', () => {
    expect(isValidRitualName('a'.repeat(61))).toBe(false);
    expect(isValidRitualName('a'.repeat(60))).toBe(true);
  });
});

describe('sortRituals', () => {
  it('puts favorites before non-favorites regardless of recency', () => {
    const oldFavorite = makeRitual({ id: 'a', isFavorite: true, lastUsedAt: T0 });
    const recentNonFavorite = makeRitual({ id: 'b', isFavorite: false, lastUsedAt: T0 + DAY });
    const sorted = sortRituals([recentNonFavorite, oldFavorite]);
    expect(sorted.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('orders by most-recently-used within the same favorite tier', () => {
    const usedYesterday = makeRitual({ id: 'a', lastUsedAt: T0 });
    const usedToday = makeRitual({ id: 'b', lastUsedAt: T0 + DAY });
    const sorted = sortRituals([usedYesterday, usedToday]);
    expect(sorted.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('sorts never-used rituals after used ones, by newest created first', () => {
    const used = makeRitual({ id: 'used', lastUsedAt: T0, createdAt: T0 - DAY });
    const newerUnused = makeRitual({ id: 'newer-unused', lastUsedAt: null, createdAt: T0 + DAY });
    const olderUnused = makeRitual({ id: 'older-unused', lastUsedAt: null, createdAt: T0 });
    const sorted = sortRituals([olderUnused, used, newerUnused]);
    expect(sorted.map((r) => r.id)).toEqual(['used', 'newer-unused', 'older-unused']);
  });

  it('does not mutate the input array', () => {
    const rituals = [makeRitual({ id: 'a' }), makeRitual({ id: 'b' })];
    const original = [...rituals];
    sortRituals(rituals);
    expect(rituals).toEqual(original);
  });
});

describe('duplicateRitualName', () => {
  it('appends "(Copy)" when the base name is free', () => {
    expect(duplicateRitualName('Deep Work', [])).toBe('Deep Work (Copy)');
  });

  it('increments when "(Copy)" is already taken', () => {
    expect(duplicateRitualName('Deep Work', ['Deep Work (Copy)'])).toBe('Deep Work (Copy 2)');
  });

  it('finds the first free slot across many existing copies', () => {
    const existing = ['Deep Work (Copy)', 'Deep Work (Copy 2)', 'Deep Work (Copy 3)'];
    expect(duplicateRitualName('Deep Work', existing)).toBe('Deep Work (Copy 4)');
  });

  it('does not collide with an unrelated ritual that happens to share the base name', () => {
    expect(duplicateRitualName('Deep Work', ['Deep Work'])).toBe('Deep Work (Copy)');
  });
});

describe('ritualToSessionStart', () => {
  it('maps every timer-relevant field, including the ritual id', () => {
    const ritual = makeRitual({ id: 'r42', timerMode: 'flow', focusMinutes: 45, breakMinutes: 15, cyclesTarget: null });
    expect(ritualToSessionStart(ritual)).toEqual({
      mode: 'flow',
      focusMinutes: 45,
      breakMinutes: 15,
      cyclesTarget: null,
      ritualId: 'r42',
    });
  });
});

describe('ritualToActiveMix', () => {
  it('maps sound layers to {soundId, volume}, ordered by saved position', () => {
    const ritual = makeRitual({
      soundLayers: [
        { soundId: 'brown-noise', volume: 0.6, position: 1 },
        { soundId: 'rain', volume: 0.3, position: 0 },
      ],
    });
    expect(ritualToActiveMix(ritual)).toEqual([
      { soundId: 'rain', volume: 0.3 },
      { soundId: 'brown-noise', volume: 0.6 },
    ]);
  });

  it('is empty for a ritual with no ambient sounds', () => {
    expect(ritualToActiveMix(makeRitual({ soundLayers: [] }))).toEqual([]);
  });
});
