import { moodPalettes } from '../moodPalettes';
import { scenePalettes } from '../scenePalettes';
import { resolveSpacePalette } from '../spacePalette';

describe('resolveSpacePalette', () => {
  test('bundled space resolves its scene palette', () => {
    const palette = resolveSpacePalette({ kind: 'bundled', bundledSceneId: 'rain-window', paletteMood: null });
    expect(palette).toBe(scenePalettes['rain-window']);
  });

  test('custom space resolves its mood palette', () => {
    const palette = resolveSpacePalette({ kind: 'custom', bundledSceneId: null, paletteMood: 'vivid' });
    expect(palette).toBe(moodPalettes.vivid);
  });

  test('bundled space with an unknown scene id falls back to the default scene', () => {
    const palette = resolveSpacePalette({ kind: 'bundled', bundledSceneId: 'not-a-real-scene', paletteMood: null });
    expect(palette).toBe(scenePalettes['amber-study']);
  });

  test('custom space with no mood set falls back to warm', () => {
    const palette = resolveSpacePalette({ kind: 'custom', bundledSceneId: null, paletteMood: null });
    expect(palette).toBe(moodPalettes.warm);
  });
});
