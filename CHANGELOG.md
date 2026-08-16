# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project follows its own phase roadmap (see `README.md`) rather than
semantic versioning until a `1.0.0` release.

## [Unreleased]

### Phase 4 — Focus Spaces & Custom Wallpapers

#### Added

- `domain/space`: `Space`/`MoodId` types and `sortSpaces` (same favorites/
  most-recently-used/newest ordering as `sortRituals`).
- `spacesRepo`: `createCustomSpace`/`updateCustomSpace`/`archiveCustomSpace` — all guard
  on `kind === 'custom'` and throw against a bundled space, keeping bundled spaces
  immutable. `getSpaceById` reads regardless of archived status, so a ritual referencing a
  deleted custom space can still resolve its photo/mood. `listSpaces` is now active-only,
  matching `listRituals`.
- `settingsRepo`: wraps the single settings row; `active_space_id` (new migration column)
  persists the user's standalone (non-ritual) Focus Space pick across restarts.
- `theme/moodPalettes.ts`: 6 hand-authored mood palettes (Warm/Cool/Muted/Vivid/Dark/Light)
  a custom photo space picks from, instead of a native image-color-extraction dependency.
  `theme/spacePalette.ts`'s `resolveSpacePalette()` resolves any Space (bundled or custom)
  to its `PaletteColors`, with safe fallbacks for an unknown scene id or missing mood.
- `lib/imagePicker.ts`: launches `expo-image-picker` and copies the selected photo into
  persistent `documentDirectory/spaces/` storage via `expo-file-system`'s `File`/
  `Directory` API — never the picker's own transient cache URI.
- `spaceStore`: wraps `spacesRepo` + `settingsRepo`, keeps a sorted in-memory cache, and
  falls back to the default bundled scene if the active standalone pick is ever archived.
- `SpacesGalleryScreen`, `SpaceCard`, `SpaceEditorScreen` (`/spaces`, `/spaces/new`,
  `/spaces/[id]` modal routes) — browse bundled and custom spaces, favorite, select,
  and create/rename/replace-photo/change-mood/delete a custom space.
- `SceneBackdrop` renders a custom space's photo instead of the drawn gradient, skipping
  the ambient glow (a colored blob over a user's own photo would read as a bug).
- Focus screen: tapping the space name now opens the Spaces gallery instead of cycling
  through bundled scenes. A ritual-tied session's saved space takes priority over the
  user's standalone pick for as long as that session lasts, and releases that priority the
  moment a plain, non-ritual session starts.
- The ritual editor's Focus Space picker and `RitualCard`'s space-name subtitle now draw
  from the full space list (bundled + custom) instead of the 3 bundled scenes only.

#### Fixed

- A Phase-2-era speculative test in `seed.test.ts` checked an archived bundled-scene row
  through `listSpaces`, which is now active-only by design — updated to read the row
  directly via `getSpaceById` instead.

### Phase 3 — Focus Rituals

#### Added

- `domain/ritual`: `Ritual`/`RitualSoundLayer` types, `sortRituals` (favorites, then
  most-recently-used, then newest), `duplicateRitualName` (collision-avoiding
  "(Copy)"/"(Copy N)"), and the `ritualToSessionStart`/`ritualToActiveMix` mappers.
- `ritualsRepo`: full local CRUD — create/update (transactionally replace sound layers,
  not merge), duplicate, soft delete (archive), favorite toggle, mark-used — plus
  `countAllRituals` (includes archived, distinct from the active-only `countRituals`).
- `seedExampleRituals.ts`: 3 example rituals (one per bundled scene), seeded once on the
  very first run and never resurrected after the user deletes them.
- `ritualStore`: wraps `ritualsRepo`, keeps a `sortRituals`-ordered in-memory cache.
- `RitualsListScreen`, `RitualCard`, `RitualEditorScreen` (`rituals/new` and
  `rituals/[id]` modal routes) — create, edit, duplicate, delete, and favorite from the
  Rituals tab.
- Start-from-ritual on the Focus screen: loads the ritual's saved space and sound mix and
  starts the timer with its mode/durations — and restores the same scene/mix on
  cold-start recovery, not just an explicit start.
- `VolumeBar` promoted from a `SoundMixerSheet`-private component to a shared primitive,
  reused by the ritual editor's (local, non-live) sound-mix draft.

#### Fixed

- `countAllRituals` added specifically because the example-ritual seed's original
  "seed if `countRituals() === 0`" check would have resurrected the 3 examples after a
  user deleted all of them (soft delete brings the *active* count back to 0, but the
  seed should only ever run once, ever).
- `.wasm` registered as a Metro asset extension (`metro.config.js`) — expo-sqlite's web
  implementation was crashing the web bundle at import time, a Metro/expo-sqlite
  web-packaging gap unrelated to application code, but one that blocked using the browser
  preview to verify anything once a screen touched the database.

### Phase 2 — Persistence Foundation

#### Added

- `src/db/`: a `Database` interface (`types.ts`) every repository takes as an explicit
  parameter instead of importing a singleton, so tests can substitute a
  [`node:sqlite`](https://nodejs.org/api/sqlite.html)-backed implementation with no
  native module and no new dependency.
- Versioned, additive migrations (`schema.ts`, `PRAGMA user_version`-driven) creating
  all seven planned tables: `spaces`, `sounds`, `rituals`, `ritual_sound_layers`,
  `tasks`, `sessions`, `settings`.
- `sessionsRepo`, `spacesRepo`, `soundsRepo`, and an idempotent bundled-data seed
  (`seed.ts`) — `INSERT OR IGNORE` keyed by each scene/sound's own stable id.
- `timerStore` now persists every session mutation and recovers a running/paused
  session across an app restart (`hydrate()`), reconciling it through the same
  `reconcile()` used for backgrounding.
- Test coverage for migrations, `sessionsRepo` (including simulated cold-start
  recovery), and repeated-seed idempotency — all run against real SQLite via
  `node:sqlite`, not a hand-rolled mock.

#### Fixed

- `reconcile()` now guards against re-processing an already-halted session. Without
  this, calling it twice (the exact shape cold-start recovery introduces) would
  double-increment `cyclesCompleted` for Flow Mode's focus-boundary halt.

### Phase 1 — Architecture, Design System, Focus Screen Prototype

#### Added

- Project scaffold on Expo SDK 54, Expo Router, strict TypeScript, ESLint
  flat config, Jest (`jest-expo`) with domain-layer coverage.
- Timestamp-based timer engine (`src/domain/timer`) with deterministic
  multi-boundary reconciliation and Flow Mode's "keep the flow?" decision.
- WCAG contrast helper (`src/domain/palette`) backing adaptive scene
  palettes.
- Design system: tokens, motion presets, Fraunces/Manrope typography, three
  hand-authored Focus Space scene palettes, and a dual-palette
  `ThemeProvider` (neutral chrome palette + per-scene palette).
- Shared UI primitives: `Text`, `Button`, `Surface`, `IconButton`, `Chip`,
  `Screen`, `EmptyState`.
- Zustand `timerStore` (AppState-driven reconciliation) and `soundStore`.
- Ambient sound engine (`src/lib/audio`) with sticky lock-screen ownership,
  volume ramping, and three procedurally-generated bundled loops (rain,
  white noise, brown noise — no external audio assets).
- Haptics wrapper (`src/lib/haptics`).
- Focus screen: SVG progress ring, code-drawn scene backdrop, 6 timer modes,
  functional ambient sound mixer sheet.
- Tab navigation (Focus real; Rituals/Tasks/History/Settings as
  placeholders).
- `ASSET_LICENSES.md` documenting bundled asset provenance.

#### Fixed

- Disabled the `reactCompiler` experiment — it broke live re-renders against
  the external Zustand store, freezing the timer display.
- Clamped the timer ring's SVG radius against a zero-width first layout pass.
- Rebuilt the sound mixer sheet's bottom-sheet layout with explicit
  `flex`/`justifyContent` instead of relying on implicit `Modal` behavior.

[Unreleased]: https://github.com/soyleremo3/focus-ritual/commits/main
