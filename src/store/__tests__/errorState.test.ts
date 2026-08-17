// Regression coverage for the Phase 8 hardening fix: a failed refresh() used to leave
// `loaded: false` forever (screens stuck on a blank list/"Loading..." with no way out).
// refresh() must now catch, set a user-facing `error`, and still flip `loaded: true` so the
// screen can show a retry state instead of hanging indefinitely.

import { getDatabase } from '@/db/client';
import { listRituals } from '@/db/repositories/ritualsRepo';
import { listSpaces } from '@/db/repositories/spacesRepo';

import { useRitualStore } from '../ritualStore';
import { useSpaceStore } from '../spaceStore';
import { useTaskStore } from '../taskStore';

jest.mock('@/db/client', () => ({ getDatabase: jest.fn() }));
jest.mock('@/db/repositories/ritualsRepo', () => ({ listRituals: jest.fn() }));
jest.mock('@/db/repositories/tasksRepo', () => ({ listTasks: jest.fn() }));
jest.mock('@/db/repositories/spacesRepo', () => ({ listSpaces: jest.fn() }));
jest.mock('@/db/repositories/settingsRepo', () => ({ getActiveSpaceId: jest.fn().mockResolvedValue(null) }));

const mockGetDatabase = getDatabase as jest.Mock;
const mockListRituals = listRituals as jest.Mock;
const mockListSpaces = listSpaces as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // spaceStore.ts calls hydrate() -> refresh() once at module load; give it a database so
  // that first automatic call doesn't itself throw before a test is ready to assert on it.
  mockGetDatabase.mockResolvedValue({});
  mockListSpaces.mockResolvedValue([]);
});

describe('ritualStore.refresh() error handling', () => {
  it('sets error and loaded:true instead of leaving loaded stuck at false', async () => {
    mockGetDatabase.mockRejectedValueOnce(new Error('disk full'));

    await useRitualStore.getState().refresh();

    expect(useRitualStore.getState().error).toBe('Could not load rituals.');
    expect(useRitualStore.getState().loaded).toBe(true);
  });

  it('clears error on a subsequent successful refresh', async () => {
    mockGetDatabase.mockRejectedValueOnce(new Error('disk full'));
    await useRitualStore.getState().refresh();
    expect(useRitualStore.getState().error).not.toBeNull();

    mockGetDatabase.mockResolvedValueOnce({});
    mockListRituals.mockResolvedValueOnce([]);
    await useRitualStore.getState().refresh();

    expect(useRitualStore.getState().error).toBeNull();
  });
});

describe('taskStore.refresh() error handling', () => {
  it('sets error and loaded:true instead of leaving loaded stuck at false', async () => {
    mockGetDatabase.mockRejectedValueOnce(new Error('disk full'));

    await useTaskStore.getState().refresh();

    expect(useTaskStore.getState().error).toBe('Could not load tasks.');
    expect(useTaskStore.getState().loaded).toBe(true);
  });
});

describe('spaceStore.refresh() error handling', () => {
  it('sets error and loaded:true instead of leaving loaded stuck at false', async () => {
    mockGetDatabase.mockRejectedValueOnce(new Error('disk full'));

    await useSpaceStore.getState().refresh();

    expect(useSpaceStore.getState().error).toBe('Could not load Focus Spaces.');
    expect(useSpaceStore.getState().loaded).toBe(true);
  });
});
