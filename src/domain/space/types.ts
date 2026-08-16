export const MOOD_IDS = ['warm', 'cool', 'muted', 'vivid', 'dark', 'light'] as const;
export type MoodId = (typeof MOOD_IDS)[number];

export type SpaceKind = 'bundled' | 'custom';

export interface Space {
  id: string;
  name: string;
  kind: SpaceKind;
  /** Set when kind === 'bundled'; keys into theme/scenePalettes. */
  bundledSceneId: string | null;
  /** Set when kind === 'custom'; a persistent local file URI, never a transient picker cache path. */
  imageUri: string | null;
  /** Set when kind === 'custom'; keys into theme/moodPalettes. */
  paletteMood: MoodId | null;
  isFavorite: boolean;
  lastUsedAt: number | null;
  createdAt: number;
  isArchived: boolean;
}
