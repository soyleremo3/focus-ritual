import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/store/settingsStore';

import { durations, easing, springConfig } from './motion';
import { defaultSceneId, scenePalettes, type SceneId, type ScenePalette } from './scenePalettes';
import { fontSize, fontWeight, lineHeight, radius, spacing, tracking } from './tokens';
import { fontFamily } from './typography';

export interface NeutralPalette {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  isDark: boolean;
}

/**
 * Neutral chrome palette — for ordinary app screens (Rituals, Tasks, History, Settings),
 * not the Focus screen's scene backdrop. Kept separate from useScenePalette() so the rest
 * of the app stays coherent while the Focus screen adapts per Focus Space.
 */
const lightNeutral: NeutralPalette = {
  background: '#FBF6EF',
  surface: '#FFFFFF',
  border: '#E7DFD2',
  text: '#241C12',
  textMuted: '#6B6153',
  accent: '#B5652F',
  onAccent: '#FBF6EF',
  isDark: false,
};

const darkNeutral: NeutralPalette = {
  background: '#17130E',
  surface: '#231D15',
  border: '#382F22',
  text: '#F3ECE0',
  textMuted: '#A69C8B',
  accent: '#E8935B',
  onAccent: '#241C12',
  isDark: true,
};

interface ThemeContextValue {
  colorScheme: 'light' | 'dark';
  neutral: NeutralPalette;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  lineHeight: typeof lineHeight;
  tracking: typeof tracking;
  fontFamily: typeof fontFamily;
  motion: { durations: typeof durations; easing: typeof easing; springConfig: typeof springConfig };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const themeModePreference = useSettingsStore((s) => s.settings.themeMode);
  const colorScheme: 'light' | 'dark' =
    themeModePreference === 'light'
      ? 'light'
      : themeModePreference === 'dark'
        ? 'dark'
        : systemScheme === 'dark'
          ? 'dark'
          : 'light';
  const neutral = colorScheme === 'dark' ? darkNeutral : lightNeutral;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colorScheme,
      neutral,
      spacing,
      radius,
      fontSize,
      fontWeight,
      lineHeight,
      tracking,
      fontFamily,
      motion: { durations, easing, springConfig },
    }),
    [colorScheme, neutral]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

/** Keyed by the active Focus Space — consumed only by the Focus screen and scene backdrops. */
export function useScenePalette(sceneId?: SceneId): ScenePalette {
  return scenePalettes[sceneId ?? defaultSceneId];
}
