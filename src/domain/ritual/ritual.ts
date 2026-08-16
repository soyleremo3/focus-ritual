import type { Ritual, RitualSessionStart } from './types';

/** Matches store/soundStore.ts's ActiveLayer shape structurally — domain stays framework-independent, so it doesn't import from store/. */
export interface RitualMixLayer {
  soundId: string;
  volume: number;
}

const MAX_NAME_LENGTH = 60;

export function isValidRitualName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH;
}

/**
 * Favorites first, then most-recently-used, then newest. A never-used ritual (no
 * lastUsedAt) sorts after every used one within the same favorite tier, ordered by
 * creation time.
 */
export function sortRituals(rituals: Ritual[]): Ritual[] {
  return [...rituals].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    const aUsed = a.lastUsedAt ?? -Infinity;
    const bUsed = b.lastUsedAt ?? -Infinity;
    if (aUsed !== bUsed) return bUsed - aUsed;
    return b.createdAt - a.createdAt;
  });
}

const COPY_LABEL = 'Copy';

/**
 * "Deep Work" -> "Deep Work (Copy)" -> "Deep Work (Copy 2)" -> ..., skipping whatever
 * name is already taken so a repeated duplicate never collides.
 */
export function duplicateRitualName(originalName: string, existingNames: string[]): string {
  const taken = new Set(existingNames);
  const base = `${originalName} (${COPY_LABEL})`;
  if (!taken.has(base)) return base;

  let n = 2;
  while (taken.has(`${originalName} (${COPY_LABEL} ${n})`)) {
    n += 1;
  }
  return `${originalName} (${COPY_LABEL} ${n})`;
}

export function ritualToSessionStart(ritual: Ritual): RitualSessionStart {
  return {
    mode: ritual.timerMode,
    focusMinutes: ritual.focusMinutes,
    breakMinutes: ritual.breakMinutes,
    cyclesTarget: ritual.cyclesTarget,
    ritualId: ritual.id,
  };
}

/** Ordered by the layer's saved position — matches how it was arranged when saved. */
export function ritualToActiveMix(ritual: Ritual): RitualMixLayer[] {
  return [...ritual.soundLayers]
    .sort((a, b) => a.position - b.position)
    .map((layer) => ({ soundId: layer.soundId, volume: layer.volume }));
}
