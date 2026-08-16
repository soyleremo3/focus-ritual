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
- **Layered ambient sound mixer** — 7 bundled loops across 3 categories, multiple
  simultaneous layers, independent per-layer volume, a master volume, smooth crossfades on
  every add/remove, real background playback, and sticky lock-screen media-session
  ownership (see [Ambient sound mixer](#ambient-sound-mixer) below)
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
      sound/                     framework-independent sound engine core (see
                                  Ambient sound mixer below) + selectLockScreenOwner
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
      sound/                     SoundMixEditor — shared by the mixer sheet and the
                                  ritual editor's sound-mix draft
    components/                 shared, theme-aware UI primitives
    lib/                        imperative wrappers around native/expo modules
      audio/soundEngine.ts       thin expo-audio wrapper around domain/sound's engine core
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

**Library**: 7 procedurally-synthesized loops (`assets/sounds/`, see
`ASSET_LICENSES.md`) across 3 categories — Rain/Ocean Waves/Wind (nature), White/Brown/Pink
Noise (noise), Fireplace (ambience). `src/features/sound/SoundMixEditor.tsx` is a shared
category-filter-plus-search editor used both by the live mixer sheet on the Focus screen
and by the ritual editor's local sound-mix draft, so the two never drift into duplicated
list-rendering code.

**Engine**: `src/domain/sound/soundEngine.ts` is the framework-independent core (no
expo-audio import — just an `EnginePlayer` interface a real player or a test fake can
satisfy), unit-tested with fake timers and a fake player. `src/lib/audio/soundEngine.ts`
is a thin wrapper plugging real `expo-audio` `AudioPlayer`s into it as the app's singleton
instance. `setMix()` reconciles the active player pool against a desired mix:

- A newly-added layer ramps in from 0 (500ms).
- A removed layer **fades out over the same ramp before being released** — not an
  instant cut, which is what smooth crossfading requires and what the original Phase 1
  implementation didn't do.
- If a layer reappears while its old instance is still mid-fade-out toward removal, the
  pending removal is cancelled and the *same* player instance ramps back up — rapid
  toggling can never produce a duplicate player or a leaked one.
- An unknown sound id is skipped rather than left as a dangling entry.

Exactly one player owns lock-screen/background-session activation
(`setActiveForLockScreen`), chosen by `selectLockScreenOwner()` — a pure, unit-tested
function. Ownership is **sticky**: it changes only when the current owner's layer is
removed from the mix, never on a volume change or a new layer joining, with a
highest-current-volume (lowest-id tie-break) rule for picking the replacement. This exact
algorithm carried over unchanged from Phase 1 through the Phase 5 engine extraction —
only its home and test coverage changed.

**Master volume**: `soundStore` holds a `masterVolume` (0–1) alongside each layer's own
volume; the engine itself has no separate "master" concept; the store just computes
`layerVolume × masterVolume` for every layer before calling the same `setMix()`/
`setLayerVolume()` the engine already exposed. A master volume change therefore gets the
exact same smooth ramp as any other volume change, for free.

**Persistence and ritual override**: `settingsRepo`'s `active_sound_mix` (JSON) and
`master_volume` columns hold the user's *standalone* mix — every freeform edit
(`toggleLayer`/`setLayerVolume`/`setMasterVolume`) persists it, and a module-load
`hydrate()` restores it on app start (loaded, but not auto-played — ambient audio
starting itself the instant the app opens would be surprising). Applying a ritual's saved
mix (`applyRitualMix`, used by [Focus Rituals](#focus-rituals)' start/cold-start-recovery
flow) is a **live override that never persists**, mirroring how a ritual's Focus Space
overrides the standalone pick without clobbering it (Phase 4) — starting a plain,
non-ritual session calls `restoreStandaloneMix()` to release that override and fall back
to the user's own saved mix.

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

**Phase 5 — Sound library & mixer polish.** ✅ Bundled library expanded 3 → 7 loops across
nature/noise/ambience categories; `domain/sound` engine core extracted and unit-tested
(fixing an abrupt-cut-on-removal gap and a rapid-toggle duplicate-player race along the
way); master volume; standalone mix persisted via `settingsRepo` and restored (not
auto-played) on app start; `SoundMixEditor` shared between the mixer sheet and the ritual
editor's sound-mix draft. See [Ambient sound mixer](#ambient-sound-mixer) above.

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

Before Phase 6 begins, all of the following must pass:

1. `npm run typecheck`, `npm run lint`, `npx expo-doctor` — all clean.
2. `npm test` — passes, including `domain/timer/timerEngine`, `domain/palette/
   paletteContrast`, `domain/ritual/ritual`, `domain/space/space`, `domain/sound/
   soundEngine` (fake-timer-driven: no duplicate players, fade-out-before-release,
   cancel-pending-removal-on-re-add, sticky lock-screen ownership), `theme/spacePalette`,
   and every `db/__tests__` suite (migrations, `sessionsRepo`, `ritualsRepo`,
   `spacesRepo`, `settingsRepo` including the sound-mix/master-volume columns,
   bundled-data seed idempotency, example-ritual seed idempotency — run against a real
   `node:sqlite`-backed database, not a hand-rolled mock).
3. In the Expo (web) preview: Focus tab renders correctly (hero timer, scene backdrop, all
   6 modes); Rituals tab shows the 3 seeded examples; create/edit/duplicate/delete/favorite
   all work and the list re-sorts correctly; starting a ritual switches to the Focus tab
   with its scene and sound mix loaded and the timer running with its saved
   mode/durations; the Spaces gallery opens from the Focus screen, shows the 3 bundled
   scenes, lets a custom space be created/favorited/edited/renamed/deleted, and switching
   spaces updates the Focus screen immediately and persists across a reload; a ritual
   referencing a since-deleted custom space still starts correctly with that space's
   original photo/mood; the sound mixer shows all 7 sounds with working category/search
   filters, multiple simultaneous layers, per-layer and master volume sliders, and a
   master play/pause; the standalone mix (layers + master volume) persists across a
   reload and restores loaded-but-paused; editing a ritual's sound mix in its editor saves
   correctly and starting that ritual applies the saved mix; the other 3 tabs render their
   empty state without crashing.
4. **Real-device smoke tests on a real Android device** (a dev client build if Expo Go
   can't reproduce the native behavior being tested):
   - Start a timer, lock/background the phone, foreground it — elapsed time reconciles
     correctly with no drift or double-counting.
   - Start a timer, force-quit the app, relaunch it — the session recovers with elapsed
     time reconciled correctly (Phase 2's cold-start recovery, not just backgrounding).
   - Start a session from a ritual, force-quit, relaunch — both the elapsed time *and*
     the ritual's scene/sound mix recover (Phase 3's addition to cold-start recovery,
     verified in the web preview; confirm on-device too).
   - Toggle several sound layers on/off in quick succession and drag their volume plus the
     master volume in the mixer sheet — real audio plays, layers crossfade smoothly with
     no clicks or gaps, and rapid toggling never produces overlapping/doubled playback of
     the same sound.
   - With a multi-layer sound mix playing, lock the screen and background the app for
     several minutes — playback continues uninterrupted and lock-screen media controls
     stay attached to the same sticky-owner layer throughout.
   - Force-quit and relaunch with a standalone (non-ritual) mix active — the same layers
     and volumes are loaded on the Focus screen, paused, exactly as persisted.
   - Pick a photo from the device's own library as a custom Focus Space — confirm the
     photo persists (force-quit and relaunch, then check the space still shows it) rather
     than depending on the picker's own transient cache URI. This is the one Phase 4 path
     that can't be meaningfully exercised through the web preview, since `imagePicker.ts`
     takes a different (untested-here) code path on web — see
     [Focus Spaces & custom wallpapers](#focus-spaces--custom-wallpapers) above.
