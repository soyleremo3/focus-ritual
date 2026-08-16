import type { MoodId, SpaceKind } from '@/domain/space/types';

import { moodPalettes } from './moodPalettes';
import { defaultSceneId, scenePalettes, type PaletteColors, type SceneId } from './scenePalettes';

export interface SpacePaletteInput {
  kind: SpaceKind;
  bundledSceneId: string | null;
  paletteMood: MoodId | null;
}

/**
 * Resolves any Space (bundled or custom) to the colors its backdrop/UI should use — a
 * bundled scene's hand-authored palette, or a custom space's chosen mood palette. Falls
 * back to the default bundled scene if a bundled space somehow points at an unknown
 * scene id, and to the "warm" mood if a custom space somehow has no mood set.
 */
export function resolveSpacePalette(space: SpacePaletteInput): PaletteColors {
  if (space.kind === 'bundled') {
    const sceneId = (space.bundledSceneId ?? defaultSceneId) as SceneId;
    return scenePalettes[sceneId] ?? scenePalettes[defaultSceneId];
  }
  const mood = space.paletteMood ?? 'warm';
  return moodPalettes[mood] ?? moodPalettes.warm;
}
