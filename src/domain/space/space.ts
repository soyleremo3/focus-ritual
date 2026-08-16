import type { Space } from './types';

const MAX_NAME_LENGTH = 60;

export function isValidSpaceName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH;
}

/**
 * Favorites first, then most-recently-used, then newest — same ordering rule as
 * sortRituals, applied to the Focus Spaces gallery.
 */
export function sortSpaces(spaces: Space[]): Space[] {
  return [...spaces].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    const aUsed = a.lastUsedAt ?? -Infinity;
    const bUsed = b.lastUsedAt ?? -Infinity;
    if (aUsed !== bUsed) return bUsed - aUsed;
    return b.createdAt - a.createdAt;
  });
}
