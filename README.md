# FocusRitual

A premium, offline-first focus environment for React Native — not a generic Pomodoro
clone. A **Focus Ritual** combines a timer mode, an immersive Focus Space, and a layered
ambient sound mix into a single reusable preset. Fully offline: no accounts, no backend,
no API keys, no analytics, no paid services.

## Features

- **Timer modes** — Pomodoro, Deep Work, 90-minute, Custom, Stopwatch, and Flow Mode
  (a soft check-in interval instead of a hard cutoff — see [Timer engine](#timer-engine))
- **Focus/break cycles** with deterministic reconciliation across backgrounding, lock, and
  app kill (see [Timer engine](#timer-engine))
- **Immersive Focus Spaces** — 3 hand-authored gradient scenes, plus your own photos as
  custom wallpapers with a mood-tag palette (Warm/Cool/Muted/Vivid/Dark/Light), each with
  its own adaptive color palette (not a fixed app-wide theme) — see
  [Focus Spaces & custom wallpapers](#focus-spaces--custom-wallpapers) below
- **Layered ambient sound mixer** with real background playback, independent per-layer
  volume, and sticky lock-screen media-session ownership
- **Reusable Focus Rituals** — compose a timer mode, Focus Space, and ambient sound mix
  into a named preset; start a session directly from one (see
  [Focus Rituals](#focus-rituals) below)
- **Minimal Today tasks** *(Phase 6)*
- **Session history and local statistics** *(Phase 6)*
- **Local notifications and haptics** *(notifications: Phase 7; haptics: built now)*

## Tech stack

- Expo SDK 54 (pinned explicitly, not auto-upgraded) + React Native 0.81 + React 19
- Strict TypeScript (`noUncheckedIndexedAccess` on), path alias `@/* → src/*`
- Expo Router (file-based navigation, routes under `src/app/`)
- Zustand for state
- `expo-sqlite` for local persistence (versioned migrations, a repository layer — see
  [Persistence](#persistence) below)
- `expo-audio` for the ambient sound mixer, with real background/lock-screen playback
- `expo-notifications`, `expo-image-picker`, `expo-haptics`, `expo-file-system`,
  `expo-linear-gradient` *(scrims over Focus Space backdrops)*
- `react-native-svg` for the timer progress ring
- `react-native-reanimated` + `react-native-gesture-handler` for motion and the custom
  volume control (no `@react-native-community/slider` dependency)
- `@expo-google-fonts/fraunces` (serif display/hero numerals) +
  `@expo-google-fonts/manrope` (UI text)

## Getting started

```bash
npm install
npm run start
```

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm run test         # jest (jest-expo preset)
npm run test:coverage
```

## Project structure

```
FocusRitual/
  assets/
    sounds/            bundled ambient loops — see ASSET_LICENSES.md
  scripts/
    generate-sound-assets.mjs   regenerates the bundled ambient loops
  src/
    app/                        expo-router routes (thin; import from features/)
      _layout.tsx                providers, splash hold, audio mode setup
      (tabs)/                    Focus | Rituals | Tasks | History | Settings
      rituals/new.tsx             modal — create
      rituals/[id].tsx            modal — edit
      spaces/index.tsx             modal — gallery
      spaces/new.tsx               modal — create custom space
      spaces/[id].tsx              modal — edit custom space
    db/                         expo-sqlite: migrations, repositories (see below)
      client.ts                  getDatabase() — lazily-memoized singleton opener
      schema.ts                  versioned migrations, PRAGMA user_version-driven
      seed.ts                    idempotent bundled spaces/sounds seed
      seedExampleRituals.ts       one-time example-ritual seed (see Focus Rituals below)
      repositories/               sessionsRepo, spacesRepo, soundsRepo, ritualsRepo,
                                  settingsRepo
    domain/                     pure, framework-free, unit-tested business logic
      timer/                     timestamp-based timer engine (see below)
      palette/                   WCAG contrast helper behind scene/mood palette isDark
      ritual/                    Ritual types + sortRituals/duplicateRitualName/
                                  ritualToSessionStart/ritualToActiveMix
      space/                     Space types + isValidSpaceName/sortSpaces
    store/                      Zustand — one small store per concern, not one mega-store
      timerStore.ts              owns the AppState subscription + refresh interval + persistence
      soundStore.ts              serializable UI state only, delegates to soundEngine
      ritualStore.ts              wraps ritualsRepo, keeps a sorted in-memory cache
      spaceStore.ts               wraps spacesRepo + settingsRepo (see Focus Spaces below)
    theme/                      design system — tokens, motion, palettes, ThemeProvider
      scenePalettes.ts            3 hand-authored bundled scenes + shared PaletteColors
      moodPalettes.ts             6 mood palettes for custom-photo spaces
      spacePalette.ts             resolveSpacePalette() — bundled scene or mood, by kind
    features/
      focus/                     the Focus screen and its subcomponents
      rituals/                   RitualsListScreen, RitualCard, RitualEditorScreen
      spaces/                    SpacesGalleryScreen, SpaceCard, SpaceEditorScreen
    components/                 shared, theme-aware UI primitives
    lib/                        imperative wrappers around native/expo modules
      audio/soundEngine.ts       AudioPlayer pool, sticky lock-screen ownership
      imagePicker.ts             picks + copies a photo into persistent app storage
      haptics.ts
```

Not created yet — `tasksStore`/`settingsStore` (UI-facing), `lib/notifications/
scheduler.ts`, and the `sounds/tasks/history/settings` feature directories. Each arrives
with its own phase below rather than being pre-stubbed.

## Timer engine

The timer is timestamp-based, not interval-accumulated: a session stores `startedAt`
(epoch ms) and `accumulatedMs`, and elapsed time is always `accumulatedMs + (now -
startedAt)` — recomputed from the current timestamp on every read, never accumulated tick
by tick. A UI refresh interval just re-renders every ~300ms; a missed or throttled tick
never causes drift.

`reconcile()` (`src/domain/timer/timerEngine.ts`) runs on every app foreground and is a
**deterministic loop over every elapsed phase boundary**, not a single check — the phone
could have been locked long enough to span more than one transition. It fast-forwards
through any number of auto-started breaks, but always halts at the next boundary that
needs a human decision (`status: 'awaiting-start'`) rather than guessing intent:

- Focus → break auto-starts for every mode except Flow.
- Break → next focus never auto-starts — resuming work is a conscious action.
- Flow's focus phase is a soft check-in interval: it always halts for a **"Keep the
  flow?"** decision (keep going, extending the target, or take a break) instead of
  assuming a break was wanted.

`reconcile()` is idempotent: calling it again on a session that already halted
(`awaiting-start`, `paused`, `completed`, or `cancelled`) is a guaranteed no-op — only a
`running` session accrues wall-clock time to reconcile. This matters beyond
correctness-for-its-own-sake: cold-start recovery (below) reconciles a session that may
already have halted while the app wasn't running, and does so through the exact same
function backgrounding uses.

## Persistence

`src/db/` wraps `expo-sqlite` behind a small `Database` interface
(`src/db/types.ts`) that every repository takes as an explicit parameter rather than
importing a module-level singleton — this is what lets tests substitute a
[`node:sqlite`](https://nodejs.org/api/sqlite.html)-backed implementation
(`src/db/__tests__/testDatabase.ts`) and exercise migrations and repositories against
real SQL, with no native module and no new dependency.

`src/db/schema.ts` is a versioned, additive migration list (`PRAGMA
user_version`-driven, one transaction per migration) rather than a single-shot schema —
each future phase adds a migration instead of editing a shipped one. Phase 2's migration
creates all seven planned tables: `spaces`, `sounds`, `rituals`, `ritual_sound_layers`,
`tasks`, `sessions`, and `settings`. Timestamps are stored as epoch-ms integers, matching
the domain layer directly — no ISO string conversion at the boundary.

`src/db/client.ts`'s `getDatabase()` lazily opens the database once, memoized for the
app's lifetime: enables `PRAGMA foreign_keys`, runs pending migrations, then seeds
bundled data. `src/db/seed.ts` inserts the 3 hand-authored scene palettes into `spaces`
and the 3 bundled ambient loops into `sounds`, each `INSERT OR IGNORE`d by its own stable
id — safe to run on every app start without duplicating rows or clobbering a row a later
phase's UI has since modified.

**Session recovery**: `timerStore` persists the current session via `sessionsRepo` on
every action (fire-and-forget, so call sites stay synchronous) and on every AppState
foreground reconciliation. At module load, `hydrate()` reads the most recently updated
active session (`running` / `paused` / `awaiting-start`) and runs it through the same
`reconcile()` used for backgrounding — a cold start is just an extreme case of "the app
wasn't running for a while," so no separate recovery codepath was needed, only the
already-correct primitive.

`tasks` and `settings` have tables but no repository yet — CRUD for those lands with
their own phase (6, 7) rather than being built ahead of the UI that needs it.

## Focus Rituals

A Ritual (`src/domain/ritual/`) composes a timer mode + durations, a Focus Space, and an
ambient sound mix into one named, reusable preset — `src/db/repositories/ritualsRepo.ts`
is full local CRUD: `createRitual`/`updateRitual` (each transactionally replaces
`ritual_sound_layers` rather than merging), `duplicateRitual` (collision-avoiding
"(Copy)"/"(Copy 2)" naming via `domain/ritual`'s `duplicateRitualName`), `deleteRitual`
(soft — archives, so a session that referenced it stays valid), `setRitualFavorite`, and
`markRitualUsed`. `src/store/ritualStore.ts` wraps the repo and keeps an in-memory list
sorted by `domain/ritual`'s `sortRituals` (favorites first, then most-recently-used, then
newest) — every mutation re-fetches it.

`src/db/seedExampleRituals.ts` seeds 3 examples (one per bundled scene) the first time the
app ever runs, gated on `countAllRituals` (includes archived) rather than the active-only
`countRituals` — otherwise deleting every example would resurrect them on the next start,
since the active count would read back to 0. This is deliberately different from
`seed.ts`'s permanent `INSERT OR IGNORE` reference rows: it's a one-time "give a new
install something to start from," not a row the app always ensures exists.

**Starting from a ritual**: `RitualCard`'s Start button navigates to the Focus tab with a
`startRitualId` param. `FocusScreen` splits the resulting work into two effects instead of
one: the first (keyed off the param) only creates the session via
`ritualToSessionStart()`; the second (keyed off `session.ritualId` itself) applies the
ritual's scene and sound mix via `ritualToActiveMix()` + `soundStore.setMix()`. Splitting
them this way means the second effect *also* covers cold-start recovery — a
killed-and-relaunched app recovering a ritual-linked session via `hydrate()` (see above)
goes through the same session-ritualId effect and restores the scene/sound, not just the
elapsed time.

## Focus Spaces & custom wallpapers

A Space (`src/domain/space/`) is either **bundled** (one of the 3 hand-authored scenes,
immutable) or **custom** (a user's own photo). `src/db/repositories/spacesRepo.ts` is the
CRUD boundary: `createCustomSpace`/`updateCustomSpace`/`archiveCustomSpace` all guard on
`kind === 'custom'` and throw if pointed at a bundled space — bundled spaces are never
editable or deletable through the app, matching Phase 1's "keep bundled assets immutable"
design. `src/store/spaceStore.ts` wraps the repo with a favorite/last-used-sorted cache
(`domain/space`'s `sortSpaces`, the same ordering rule as `sortRituals`).

**Photo storage**: `src/lib/imagePicker.ts` launches `expo-image-picker` and copies the
selected photo into `Paths.document`'s `spaces/` subdirectory via `expo-file-system`'s
`File`/`Directory` API, under a generated filename — never the picker's own asset URI,
which is a transient cache path with no durability guarantee across an app restart. Web
returns the picker's own URI directly (already a self-contained blob/data URI, with no
native document directory to copy into) so the browser preview stays usable for
everything except the native copy step itself.

**Mood palettes instead of color extraction**: rather than a native
image-color-extraction dependency, a custom space picks one of 6 pre-authored mood
palettes (`src/theme/moodPalettes.ts`: Warm/Cool/Muted/Vivid/Dark/Light).
`src/theme/spacePalette.ts`'s `resolveSpacePalette()` is the single place that turns any
Space into the `PaletteColors` its backdrop/UI should use — a bundled space's hand-tuned
scene palette, or a custom space's chosen mood palette, with a safe fallback (default
scene, or the "warm" mood) if either reference is ever missing.

**Fallback when a custom space is deleted**: `archiveCustomSpace` soft-deletes — the row,
its `image_uri`, and its `palette_mood` all stay intact, so a ritual that still points at
it keeps resolving the exact same photo and palette (`spacesRepo.getSpaceById` reads
regardless of archived status). Deleting only removes it from the gallery and future space
pickers (`listSpaces` is active-only, matching `listRituals`). If the *standalone* Focus
Space the user had picked (not through a ritual) is the one archived, `spaceStore` falls
back to the default bundled scene rather than pointing the Focus screen at nothing.

**Switching spaces**: `SpacesGalleryScreen` (`/spaces`) shows bundled and active custom
spaces in a grid — tap to select, star to favorite, and (custom only) an edit icon into
`SpaceEditorScreen` (`/spaces/new` and `/spaces/[id]`) to rename, replace the photo, or
change mood, plus a delete action. On the Focus screen, tapping the space name opens the
gallery instead of the old scene-cycling button. Selecting a space there persists
immediately via `spaceStore.selectSpace()` → `settingsRepo.setActiveSpaceId()`, so it
survives an app restart independently of any ritual. A ritual-tied session's own saved
space takes priority over that standalone pick for as long as the session lasts (mirroring
[Focus Rituals](#focus-rituals)' start/cold-start-recovery design above) and releases that
priority the moment a plain, non-ritual session starts.

## Ambient sound mixer

`src/lib/audio/soundEngine.ts` is a singleton holding a pool of `expo-audio` `AudioPlayer`
instances, one per active layer, each independently volume-ramped (400–600ms, no hard
cuts). Exactly one player owns lock-screen/background-session activation
(`setActiveForLockScreen`), and that ownership is **sticky** — it changes only when the
current owner's layer is removed from the mix, never on volume changes. Every removed
player has `.remove()` called on it; nothing leaks.

Audio mode is configured once in `src/app/_layout.tsx` with `interruptionMode: 'doNotMix'`
and `shouldPlayInBackground: true`. Sustained background/lock-screen playback needs to be
verified on a real Android device (see [Verification](#verification) below) — Expo Go
cannot reproduce native background-audio behavior that depends on `app.json` config
plugins baked into a real build.

## Neutral chrome vs. scene palettes

`ThemeProvider` exposes two independent palettes: a **neutral chrome palette**
(light/dark, for ordinary app screens like Rituals/Tasks/History/Settings) and
`useScenePalette(sceneId)`/`resolveSpacePalette(space)` (keyed by the active Focus Space,
consumed only by the Focus screen and its backdrop) — so the rest of the app stays
coherent while the Focus screen adapts per space. Bundled scenes
(`src/theme/scenePalettes.ts`) are hand-authored, not extracted from a photo — hand-tuned
reads as more premium than algorithmic extraction, and keeps every bundled scene
license-free (`SceneBackdrop.tsx` draws it as a gradient in code, no image asset). Custom
spaces use the mood palette system instead — see
[Focus Spaces & custom wallpapers](#focus-spaces--custom-wallpapers) above.

## Phase roadmap

**Phase 1 — Architecture, design system, Focus screen prototype.** ✅ Project scaffold,
design tokens, `ThemeProvider`, shared UI primitives, the timer engine, a functional
ambient sound mixer, and a production-quality Focus screen.

**Phase 2 — Persistence foundation.** ✅ `src/db/` — versioned migrations for all seven
planned tables (`spaces`, `sounds`, `rituals`, `ritual_sound_layers`, `tasks`,
`sessions`, `settings`), a repository layer (`sessionsRepo`, `spacesRepo`, `soundsRepo`),
`timerStore` wired to `sessionsRepo` so a running/paused session survives an app
restart, and an idempotent seed for the bundled scenes/sounds. See
[Persistence](#persistence) above. Task/settings CRUD is intentionally not built
yet — their tables exist, but the repository functions land with the phase whose UI
needs them.

**Phase 3 — Rituals.** ✅ `ritualsRepo` (full CRUD, soft delete, favorite, last-used),
`ritualStore`, `RitualsListScreen` + `RitualCard` + `RitualEditorScreen`, 3 example
rituals seeded once on first run, and start-from-ritual on the Focus screen that
correctly restores the ritual's scene/sound even across a cold-start recovery, not just
an explicit start. See [Focus Rituals](#focus-rituals) above.

**Phase 4 — Focus Spaces gallery & custom wallpapers.** ✅ `spacesRepo` custom-space CRUD
(bundled spaces stay immutable), `spaceStore`, `SpacesGalleryScreen` + `SpaceEditorScreen`,
`lib/imagePicker.ts` (copies the picked photo into persistent `documentDirectory/spaces/`
storage, never the picker's transient URI), and the mood-tag palette chooser
(Warm/Cool/Muted/Vivid/Dark/Light → one of 6 pre-authored palettes) instead of pixel-based
color extraction. See
[Focus Spaces & custom wallpapers](#focus-spaces--custom-wallpapers) above.

**Phase 5 — Sound library & mixer polish.** Full bundled catalog, crossfade polish, saving
a mix into a Ritual, the mixer as a shared component (Focus screen + Ritual editor).

**Phase 6 — Today tasks + History/stats.** Task CRUD linked to sessions,
`domain/stats/statsAggregation.ts`, and a `HistoryScreen` built from plain Views — no
charting library added.

**Phase 7 — Notifications, haptics polish, Settings.** Full local-notification scheduling
for session completion (idempotent cancel-and-reschedule on every pause/resume/skip, the
same pattern as the timer's own reconciliation), a Settings screen, a haptics pass.

**Phase 8 — Hardening.** AppState/lock edge cases, Android sustained-background-audio
verification, accessibility (dynamic type, contrast against arbitrary user photos),
performance pass.

## Verification

Before Phase 5 begins, all of the following must pass:

1. `npm run typecheck`, `npm run lint`, `npx expo-doctor` — all clean.
2. `npm test` — passes, including `domain/timer/timerEngine`, `domain/palette/
   paletteContrast`, `domain/ritual/ritual`, `domain/space/space`, `theme/spacePalette`,
   and every `db/__tests__` suite (migrations, `sessionsRepo`, `ritualsRepo`,
   `spacesRepo`, `settingsRepo`, bundled-data seed idempotency, example-ritual seed
   idempotency — run against a real `node:sqlite`-backed database, not a hand-rolled mock).
3. In the Expo (web) preview: Focus tab renders correctly (hero timer, scene backdrop, all
   6 modes); Rituals tab shows the 3 seeded examples; create/edit/duplicate/delete/favorite
   all work and the list re-sorts correctly; starting a ritual switches to the Focus tab
   with its scene and sound mix loaded and the timer running with its saved
   mode/durations; the Spaces gallery opens from the Focus screen, shows the 3 bundled
   scenes, lets a custom space be created/favorited/edited/renamed/deleted, and switching
   spaces updates the Focus screen immediately and persists across a reload; a ritual
   referencing a since-deleted custom space still starts correctly with that space's
   original photo/mood; the other 3 tabs render their empty state without crashing.
4. **Real-device smoke tests on a real Android device** (a dev client build if Expo Go
   can't reproduce the native behavior being tested):
   - Start a timer, lock/background the phone, foreground it — elapsed time reconciles
     correctly with no drift or double-counting.
   - Start a timer, force-quit the app, relaunch it — the session recovers with elapsed
     time reconciled correctly (Phase 2's cold-start recovery, not just backgrounding).
   - Start a session from a ritual, force-quit, relaunch — both the elapsed time *and*
     the ritual's scene/sound mix recover (Phase 3's addition to cold-start recovery,
     verified in the web preview; confirm on-device too).
   - Toggle sound layers and drag their volume in the mixer sheet — real audio plays,
     mixes, and ramps.
   - With a sound mix playing, lock the screen and background the app for several
     minutes — playback continues uninterrupted.
   - Pick a photo from the device's own library as a custom Focus Space — confirm the
     photo persists (force-quit and relaunch, then check the space still shows it) rather
     than depending on the picker's own transient cache URI. This is the one Phase 4 path
     that can't be meaningfully exercised through the web preview, since `imagePicker.ts`
     takes a different (untested-here) code path on web — see
     [Focus Spaces & custom wallpapers](#focus-spaces--custom-wallpapers) above.
