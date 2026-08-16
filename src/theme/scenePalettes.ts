import { isDark } from '@/domain/palette/paletteContrast';

export type SceneId = 'amber-study' | 'rain-window' | 'midnight-forest';

/** The color set every backdrop (bundled gradient or custom photo) is themed against. */
export interface PaletteColors {
  /** Base scene color — SceneBackdrop renders this as a drawn gradient for bundled scenes. */
  background: string;
  backgroundSecondary: string;
  scrimTop: string;
  scrimBottom: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  isDark: boolean;
}

export interface ScenePalette extends PaletteColors {
  id: SceneId;
  name: string;
  description: string;
}

type SceneDraft = Omit<ScenePalette, 'isDark'>;

const drafts: Record<SceneId, SceneDraft> = {
  'amber-study': {
    id: 'amber-study',
    name: 'Amber Study',
    description: 'A warm desk lamp, worn leather, and quiet paper.',
    background: '#2B1D12',
    backgroundSecondary: '#4A3728',
    scrimTop: 'rgba(20,12,6,0.15)',
    scrimBottom: 'rgba(12,7,4,0.72)',
    surface: 'rgba(255,244,230,0.09)',
    text: '#F7ECDD',
    textMuted: 'rgba(247,236,221,0.64)',
    accent: '#E8935B',
    onAccent: '#2B1D12',
  },
  'rain-window': {
    id: 'rain-window',
    name: 'Rain Window',
    description: 'Overcast light through glass, softened and slow.',
    background: '#1B2630',
    backgroundSecondary: '#33475A',
    scrimTop: 'rgba(10,16,22,0.12)',
    scrimBottom: 'rgba(7,11,16,0.74)',
    surface: 'rgba(224,236,244,0.08)',
    text: '#E7EFF4',
    textMuted: 'rgba(231,239,244,0.62)',
    accent: '#7FB3C9',
    onAccent: '#122029',
  },
  'midnight-forest': {
    id: 'midnight-forest',
    name: 'Midnight Forest',
    description: 'Deep green dark, a still and nocturnal quiet.',
    background: '#141F19',
    backgroundSecondary: '#26392F',
    scrimTop: 'rgba(8,12,10,0.15)',
    scrimBottom: 'rgba(5,9,7,0.76)',
    surface: 'rgba(226,240,231,0.07)',
    text: '#E8F2EA',
    textMuted: 'rgba(232,242,234,0.6)',
    accent: '#7FBF97',
    onAccent: '#0E1712',
  },
};

export const scenePalettes: Record<SceneId, ScenePalette> = Object.fromEntries(
  Object.entries(drafts).map(([id, draft]) => [id, { ...draft, isDark: isDark(draft.background) }])
) as Record<SceneId, ScenePalette>;

export const sceneList: ScenePalette[] = Object.values(scenePalettes);

export const defaultSceneId: SceneId = 'amber-study';
