import { contrastRatio } from '@/domain/palette/paletteContrast';

import { darkNeutral, lightNeutral } from '../ThemeProvider';
import { moodList } from '../moodPalettes';
import { sceneList } from '../scenePalettes';

// WCAG 2.1 thresholds: 4.5:1 for normal text (AA), 3:1 for UI component/border boundaries.
const TEXT_AA = 4.5;
const UI_AA = 3;

describe('neutral chrome palette contrast (WCAG AA)', () => {
  it.each([
    ['light', lightNeutral],
    ['dark', darkNeutral],
  ])('%s: text/onAccent clear 4.5:1, border clears 3:1', (_label, palette) => {
    expect(contrastRatio(palette.text, palette.background)).toBeGreaterThanOrEqual(TEXT_AA);
    expect(contrastRatio(palette.text, palette.surface)).toBeGreaterThanOrEqual(TEXT_AA);
    expect(contrastRatio(palette.onAccent, palette.accent)).toBeGreaterThanOrEqual(TEXT_AA);
    expect(contrastRatio(palette.border, palette.background)).toBeGreaterThanOrEqual(UI_AA);
    expect(contrastRatio(palette.border, palette.surface)).toBeGreaterThanOrEqual(UI_AA);
  });
});

describe('scene palette contrast (WCAG AA)', () => {
  it.each(sceneList.map((s) => [s.id, s] as const))('%s: text/onAccent clear 4.5:1', (_id, scene) => {
    expect(contrastRatio(scene.text, scene.background)).toBeGreaterThanOrEqual(TEXT_AA);
    expect(contrastRatio(scene.onAccent, scene.accent)).toBeGreaterThanOrEqual(TEXT_AA);
  });
});

describe('mood palette contrast (WCAG AA)', () => {
  it.each(moodList.map((m) => [m.id, m] as const))('%s: text/onAccent clear 4.5:1', (_id, mood) => {
    expect(contrastRatio(mood.text, mood.background)).toBeGreaterThanOrEqual(TEXT_AA);
    expect(contrastRatio(mood.onAccent, mood.accent)).toBeGreaterThanOrEqual(TEXT_AA);
  });
});
