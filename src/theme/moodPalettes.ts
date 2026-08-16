import { isDark } from '@/domain/palette/paletteContrast';
import type { MoodId } from '@/domain/space/types';

import type { PaletteColors } from './scenePalettes';

export interface MoodPalette extends PaletteColors {
  id: MoodId;
  label: string;
}

/**
 * The mood-tag chooser for user photos (Phase 4) — six pre-authored color treatments a
 * custom Focus Space's scrim/text/accent draw from, so a wallpaper never needs a native
 * image-color-extraction dependency. `background`/`backgroundSecondary` only surface as a
 * fallback if the photo itself fails to load.
 */
type MoodDraft = Omit<MoodPalette, 'isDark'>;

const drafts: Record<MoodId, MoodDraft> = {
  warm: {
    id: 'warm',
    label: 'Warm',
    background: '#2B1D12',
    backgroundSecondary: '#4A3728',
    scrimTop: 'rgba(20,12,6,0.18)',
    scrimBottom: 'rgba(12,7,4,0.76)',
    surface: 'rgba(255,244,230,0.1)',
    text: '#F7ECDD',
    textMuted: 'rgba(247,236,221,0.66)',
    accent: '#E8935B',
    onAccent: '#2B1D12',
  },
  cool: {
    id: 'cool',
    label: 'Cool',
    background: '#16232E',
    backgroundSecondary: '#284052',
    scrimTop: 'rgba(9,15,21,0.18)',
    scrimBottom: 'rgba(6,10,15,0.78)',
    surface: 'rgba(220,236,248,0.1)',
    text: '#E6F0F7',
    textMuted: 'rgba(230,240,247,0.64)',
    accent: '#6FA8D8',
    onAccent: '#0F1E29',
  },
  muted: {
    id: 'muted',
    label: 'Muted',
    background: '#241F1B',
    backgroundSecondary: '#3B342E',
    scrimTop: 'rgba(16,14,12,0.22)',
    scrimBottom: 'rgba(10,9,8,0.72)',
    surface: 'rgba(235,229,220,0.09)',
    text: '#EAE3D9',
    textMuted: 'rgba(234,227,217,0.6)',
    accent: '#B8A48C',
    onAccent: '#221D18',
  },
  vivid: {
    id: 'vivid',
    label: 'Vivid',
    background: '#241226',
    backgroundSecondary: '#421F45',
    scrimTop: 'rgba(18,8,20,0.2)',
    scrimBottom: 'rgba(12,5,14,0.78)',
    surface: 'rgba(255,232,247,0.1)',
    text: '#FBEBFA',
    textMuted: 'rgba(251,235,250,0.66)',
    accent: '#E85DA0',
    onAccent: '#26081C',
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    background: '#0C0C0E',
    backgroundSecondary: '#1B1B1F',
    scrimTop: 'rgba(4,4,5,0.28)',
    scrimBottom: 'rgba(2,2,3,0.84)',
    surface: 'rgba(235,235,240,0.08)',
    text: '#F0F0F3',
    textMuted: 'rgba(240,240,243,0.6)',
    accent: '#9A9AA4',
    onAccent: '#0C0C0E',
  },
  light: {
    id: 'light',
    label: 'Light',
    background: '#F6F1E7',
    backgroundSecondary: '#EAE0CC',
    scrimTop: 'rgba(255,252,244,0.1)',
    scrimBottom: 'rgba(255,252,244,0.7)',
    surface: 'rgba(40,32,20,0.06)',
    text: '#2B2417',
    textMuted: 'rgba(43,36,23,0.62)',
    accent: '#B5652F',
    onAccent: '#FBF6EF',
  },
};

export const moodPalettes: Record<MoodId, MoodPalette> = Object.fromEntries(
  Object.entries(drafts).map(([id, draft]) => [id, { ...draft, isDark: isDark(draft.background) }])
) as Record<MoodId, MoodPalette>;

export const moodList: MoodPalette[] = Object.values(moodPalettes);
