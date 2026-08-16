# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project follows its own phase roadmap (see `README.md`) rather than
semantic versioning until a `1.0.0` release.

## [Unreleased]

### Phase 7 — Notifications, Haptics Polish & Settings

#### Added

- Migration v5: `default_focus_minutes`, `default_break_minutes`, `auto_start_breaks`,
  `auto_start_next_focus`, `pause_sound_with_timer`. `settingsRepo.getSettings()`/
  `updateSettings()` consolidate these plus the previously-dormant `theme_mode`/
  `haptics_enabled`/`notifications_enabled`/`week_starts_on` into one `AppSettings` type.
  `default_ritual_id`/`onboarding_complete` stay dormant — no feature to attach them to.
- `settingsStore` — hydrated once at module load like `soundStore`/`timerStore`, with an
  optimistic `update()`.
- `domain/timer/timerEngine`: `autoStarts()`/`reconcile()` take an optional
  `AutoStartSettings` (`autoStartBreaks`, `autoStartNextFocus`), defaulting to the
  previously-hardcoded behavior so every existing call site is unaffected. Flow mode's
  break decision stays deliberate regardless of the setting.
- `domain/notifications/notificationPlan.ts`: pure `planPhaseEndNotification(session, now)`
  — what (if anything) to schedule for the session's current phase end. Unit-tested
  independently of the expo-notifications wrapper around it.
- `lib/notifications/scheduler.ts`: Android notification channel setup, graceful
  permission check/request (never blocks a timer action), and schedule/cancel against a
  single fixed identifier — no notification ID ever needs to be persisted or tracked.
- `timerStore.syncNotification()`, called after every session-mutating action
  (start/pause/resume/advancePhase/continueFocus/cancel/finish) and every `reconcile()`
  call site, so pause/resume/reset/finish/cancel/app-restart/recovered-session all
  reschedule or cancel the phase-end notification correctly.
- `haptics.ts` now checks `hapticsEnabled` before every call — one gate instead of editing
  each of the ~15 existing call sites. `success()` (previously defined but never called)
  is wired into `FocusScreen`'s Finish action and into live (foregrounded) phase
  completion — never into background/cold-start reconcile, since the user wasn't looking.
- `ThemeProvider` reads `themeMode` to override `useColorScheme()`; `HistoryScreen` reads
  `weekStartsOn` for `startOfWeek()`/`weeklyRhythm()` (the domain layer already accepted
  this parameter since Phase 6, nothing read it from settings until now).
- `FocusScreen`: pause/resume only touch ambient sound when `pauseSoundWithTimer` is on;
  starting Custom mode standalone uses `defaultFocusMinutes`/`defaultBreakMinutes` instead
  of the fixed `MODE_DEFAULTS.custom` (25/5) — the one mode meant for a user-defined
  duration outside a saved Ritual.
- `components/Toggle.tsx` — a minimal switch; no `Switch`/`Toggle` precedent existed yet.
- `features/settings/SettingsScreen.tsx` — Appearance, Timer Defaults, Notifications,
  Haptics, Sound, and Statistics sections, replacing the Settings tab's `EmptyState`.

#### Fixed

- A real, pre-existing bug found while wiring notifications: `timerStore`'s foreground
  tick loop only bumped a render counter and never called `reconcile()` — that only ran on
  an AppState background→foreground transition or cold-start `hydrate()`. A session left
  running with the app foregrounded for its *entire* duration (the common case) never left
  `'running'` on its own: the clock hit 00:00 and froze there, with Pause/Cancel/Finish
  still showing, until the app happened to be backgrounded and re-foregrounded. Fixed by
  checking `isPhaseComplete()` in the tick loop and reconciling right there when true.
- `lib/notifications/scheduler.ts` was logging `console.error` on every single timer
  action on platforms without scheduled-notification support (web has none — only
  permissions) — `ERR_UNAVAILABLE` specifically means "not implemented here," a permanent,
  expected condition, not a bug. Found while browser-smoke-testing the Settings screen:
  starting a Pomodoro flooded the console every time AppState fired. Now logged only once
  as expected instead of as an error; genuinely unexpected failures still surface normally.

### Phase 6 — Today Tasks, Session History & Statistics

#### Added

- `domain/task`: `Task` type + `isValidTaskTitle`/`sortTasks`/`nextSortOrder`.
  `tasksRepo`: full CRUD — hard delete (unlike Rituals/Spaces; `sessions.task_id`'s
  existing `ON DELETE SET NULL` handles the unlink safely, tested).
- `taskStore`, `TodayScreen` + `TaskCard` (quick-add, inline tap-to-rename, checkbox,
  per-task Start, delete with confirm), wired into the Tasks tab.
- Start-from-task on the Focus screen (`startTaskId` param): no ritual involved, starts
  with whichever mode is currently selected, tagged with `taskId`; shows the linked
  task's title while active, including after cold-start recovery.
- `finish()` in the timer engine — the deliberate-completion counterpart to `cancel()`,
  needed because Deep Work/90-minute/Stopwatch/Flow/targetless-Custom sessions have no
  `cyclesTarget` and so could never naturally reach `'completed'` via `reconcile()`.
  Surfaced as a checkmark button next to Cancel whenever a session is running, paused, or
  halted at a phase boundary.
- `TimerSession.bankedFocusMs` + `computeTotalFocusMs()` — total focus-phase time across
  a session's whole lifetime, not just its current phase (`accumulatedMs` resets on every
  phase transition, so this was previously unrecoverable for any multi-cycle session).
  Migration v4 adds `sessions.banked_focus_ms`.
- `sessionsRepo.listTerminalSessions` — completed/cancelled sessions, the History data
  source. `sessions.task_id` (present since Phase 2 but never wired in) is now mapped.
- `domain/stats/statsAggregation.ts`: pure, framework-independent — `summarize`, date
  range filtering, `last7DaysBuckets`, `groupByRitual`/`groupByTask`, `favoriteRitualId`,
  `bestFocusSegment`, `weeklyRhythm`, `formatFocusDuration`. Every total derives from
  `computeTotalFocusMs()` over persisted rows — no separately-maintained counters.
- `HistoryScreen` (Today/Week/Month summary cards, a custom 7-day bar chart, weekly
  rhythm, favorite ritual, best focus time of day, ritual/task breakdowns — plain `View`s,
  no charting dependency), wired into the History tab.
- `features/history/SessionListItem.tsx` + a "Recent Sessions" list on `HistoryScreen`:
  every terminal session stays visible, cancelled ones dimmed and tagged "Cancelled".

#### Fixed

- A real double-counting bug, caught by a test written for `bankedFocusMs` rather than by
  inspection: `reconcile()`'s branch that halts Flow Mode at its focus-completion boundary
  doesn't change `phase` (it stays `'focus'`), so bumping `bankedFocusMs` *and* leaving
  `accumulatedMs` frozen there double-counted that segment the moment
  `computeTotalFocusMs`'s own current-phase check added it a second time. Fixed by only
  bumping `bankedFocusMs` in the branches that actually move `phase` away from a
  closed-out segment.
- Cancelled sessions were counting toward every stat (focus totals, session counts,
  7-day/weekly-rhythm charts, favorite ritual, best focus time) alongside completed ones —
  an abandoned 30-second session shouldn't weigh the same as one seen through to
  completion. `statsAggregation.ts` now filters cancelled sessions out of `summarize`,
  `groupBy` (and so `groupByRitual`/`groupByTask`/`favoriteRitualId`), `bestFocusSegment`,
  and `weeklyRhythm`; they still render in History's new "Recent Sessions" list, just
  excluded from the aggregates. Sessions ended via `finish()` are unaffected (they land in
  `'completed'`, same as a natural finish). Regression tests added for every aggregate
  function.

### Phase 5 — Sound Library & Mixer Polish

#### Added

- Bundled ambient library expanded from 3 to 7 procedurally-synthesized loops: Ocean
  Waves, Wind, Pink Noise, and Fireplace, grouped with the originals into nature/noise/
  ambience categories.
- `domain/sound`: `createSoundEngine()`, a framework-independent engine core (no
  expo-audio import) taking an injectable player factory — unit-tested with fake timers
  and a fake player. `selectLockScreenOwner()` and `clampVolume`/`effectiveVolume` are
  pulled out as pure functions alongside it.
- `lib/audio/soundEngine.ts` is now a thin wrapper: real `expo-audio` players plugged into
  the domain engine.
- `soundStore`: `masterVolume` (multiplies every layer's effective volume through the
  engine's existing `setMix`, no new engine-side concept needed), persistence of the
  standalone mix + master volume via `settingsRepo` on every freeform edit, and a
  module-load `hydrate()` that restores it without auto-playing.
- `settingsRepo`: `active_sound_mix` (JSON) and `master_volume` columns (migration v3),
  mirroring Phase 4's `active_space_id` persistence pattern.
- `SoundMixEditor` (`features/sound/`): category filter chips, a search box, and the
  layer toggle/volume-bar list — shared by the live mixer sheet and the ritual editor's
  local sound-mix draft instead of duplicated between them. An optional master volume row
  shows only for the live mixer.
- `SoundMixerSheet`: master play/pause toggle and master volume slider, built on the
  shared editor.

#### Fixed

- Removing a sound layer used to `pause()`+`remove()` its player immediately — an audible
  click, not a crossfade. It now fades to 0 over the same ramp additions use, then
  releases the player.
- Re-adding a layer while its previous instance was still mid-fade-out toward removal
  would have raced a duplicate player into existence under rapid toggling. The pending
  removal is now cancelled and the same player instance is reused instead.
- Applying a ritual's saved sound mix (`applyRitualMix`) no longer persists as the user's
  standalone baseline — it's a live override, same as Phase 4's Focus Space override,
  released back to the standalone mix the moment a plain (non-ritual) session starts.

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
