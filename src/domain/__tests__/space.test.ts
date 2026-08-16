import { isValidSpaceName, sortSpaces } from '../space/space';
import type { Space } from '../space/types';

function makeSpace(overrides: Partial<Space>): Space {
  return {
    id: 'id',
    name: 'Space',
    kind: 'custom',
    bundledSceneId: null,
    imageUri: 'file:///a.jpg',
    paletteMood: 'warm',
    isFavorite: false,
    lastUsedAt: null,
    createdAt: 0,
    isArchived: false,
    ...overrides,
  };
}

describe('isValidSpaceName', () => {
  test('rejects empty or whitespace-only names', () => {
    expect(isValidSpaceName('')).toBe(false);
    expect(isValidSpaceName('   ')).toBe(false);
  });

  test('accepts a normal name', () => {
    expect(isValidSpaceName('My Desk')).toBe(true);
  });

  test('rejects names over 60 characters', () => {
    expect(isValidSpaceName('a'.repeat(61))).toBe(false);
    expect(isValidSpaceName('a'.repeat(60))).toBe(true);
  });
});

describe('sortSpaces', () => {
  test('favorites sort before non-favorites', () => {
    const a = makeSpace({ id: 'a', isFavorite: false, createdAt: 2 });
    const b = makeSpace({ id: 'b', isFavorite: true, createdAt: 1 });
    expect(sortSpaces([a, b]).map((s) => s.id)).toEqual(['b', 'a']);
  });

  test('within the same favorite tier, most-recently-used sorts first', () => {
    const a = makeSpace({ id: 'a', lastUsedAt: 100 });
    const b = makeSpace({ id: 'b', lastUsedAt: 200 });
    expect(sortSpaces([a, b]).map((s) => s.id)).toEqual(['b', 'a']);
  });

  test('never-used spaces sort after used ones, by newest createdAt', () => {
    const used = makeSpace({ id: 'used', lastUsedAt: 100, createdAt: 1 });
    const newer = makeSpace({ id: 'newer', lastUsedAt: null, createdAt: 50 });
    const older = makeSpace({ id: 'older', lastUsedAt: null, createdAt: 10 });
    expect(sortSpaces([older, used, newer]).map((s) => s.id)).toEqual(['used', 'newer', 'older']);
  });

  test('does not mutate the input array', () => {
    const list = [makeSpace({ id: 'a', createdAt: 1 }), makeSpace({ id: 'b', createdAt: 2 })];
    const copy = [...list];
    sortSpaces(list);
    expect(list).toEqual(copy);
  });
});
