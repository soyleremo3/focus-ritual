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
- **Immersive Focus Spaces** — hand-authored gradient scenes, each with its own adaptive
  color palette (not a fixed app-wide theme)
- **Layered ambient sound mixer** with real background playback, independent per-layer
  volume, and sticky lock-screen media-session ownership
- **Reusable Focus Ritual presets** *(Phase 3)*
- **Minimal Today tasks** *(Phase 6)*
- **Session history and local statistics** *(Phase 6)*
- **Local notifications and haptics** *(notifications: Phase 7; haptics: built now)*
- User-selected custom wallpapers *(Phase 4)*

## Tech stack

- Expo SDK 54 (pinned explicitly, not auto-upgraded) + React Native 0.81 + React 19
- Strict TypeScript (`noUncheckedIndexedAccess` on), path alias `@/* → src/*`
- Expo Router (file-based navigation, routes under `src/app/`)
- Zustand for state
- `expo-sqlite` for local persistence *(schema designed now, implemented Phase 2 — see below)*
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
    domain/                     pure, framework-free, unit-tested business logic
      timer/                     timestamp-based timer engine (see below)
      palette/                   WCAG contrast helper behind scene palette isDark
    store/                      Zustand — one small store per concern, not one mega-store
      timerStore.ts              owns the AppState subscription + refresh interval
      soundStore.ts              serializable UI state only, delegates to soundEngine
    theme/                      design system — tokens, motion, scene palettes, ThemeProvider
    features/focus/             the Focus screen and its subcomponents
    components/                 shared, theme-aware UI primitives
    lib/                        imperative wrappers around native/expo modules
      audio/soundEngine.ts       AudioPlayer pool, sticky lock-screen ownership
      haptics.ts
```

Not created yet — `db/`, `ritualStore`/`spacesStore`/`tasksStore`/`settingsStore`,
`lib/notifications/scheduler.ts`, `lib/imagePicker.ts`, and the
`rituals/spaces/sounds/tasks/history/settings` feature directories. Each arrives with its
own phase below rather than being pre-stubbed.

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

Phase 1 keeps sessions in-memory only. Cold-start/app-kill session recovery is a Phase 2
concern, once `sessionsRepo` exists to persist an in-flight session.

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

## Adaptive scene palettes

Each bundled Focus Space (`src/theme/scenePalettes.ts`) is a hand-authored color palette,
not extracted from a photo — hand-tuned reads as more premium than algorithmic extraction,
and keeps every bundled scene license-free (`SceneBackdrop.tsx` draws it as a gradient in
code, no image asset). `ThemeProvider` exposes two independent palettes: a **neutral
chrome palette** (light/dark, for ordinary app screens) and `useScenePalette(sceneId)`
(keyed by the active Focus Space, consumed only by the Focus screen) — so the rest of the
app stays coherent while the Focus screen adapts per scene.

## Phase roadmap

**Phase 1 — Architecture, design system, Focus screen prototype.** *(this phase)*
Project scaffold, design tokens, `ThemeProvider`, shared UI primitives, the timer engine,
a functional ambient sound mixer, and a production-quality Focus screen. No persistence,
no Rituals/Tasks/History/Settings screens yet.

**Phase 2 — Persistence foundation.** `src/db/client.ts` + `schema.ts` (versioned
migrations, `PRAGMA user_version`-driven) + a `repositories/` layer, wiring `timerStore` to
a `sessionsRepo` so in-flight sessions survive a cold start. Planned schema:

- `spaces` — bundled or custom Focus Spaces (`kind`, `bundled_scene_id` or `image_uri` +
  `palette_mood`)
- `sounds` — reference table seeded from `soundLibrary`
- `rituals` — timer mode + durations + `space_id` + favorite/last-used
- `ritual_sound_layers` — junction table (`ritual_id`, `sound_id`, `volume`, `position`)
- `tasks` — Today tasks, optionally linked to a ritual
- `sessions` — doubles as history **and** the in-flight record, so a cold start can
  reconstruct a running/paused session
- `settings` — single-row table (theme mode, haptics/notifications toggles, defaults)

**Phase 3 — Rituals.** CRUD/editor composing a timer mode + Focus Space + sound mix into a
named preset; start-from-ritual on the Focus screen; favorites and last-used.

**Phase 4 — Focus Spaces gallery & custom wallpapers.** Bundled scene gallery,
`expo-image-picker` flow that copies the picked photo into `documentDirectory`
(`expo-file-system`) for durable local storage, and a mood-tag palette chooser
(Warm/Cool/Muted/Vivid/Dark/Light → one of 6 pre-authored palettes) instead of pixel-based
color extraction — keeps dependencies minimal.

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

Before Phase 2 begins, all of the following must pass:

1. `npm run typecheck`, `npm run lint`, `npx expo-doctor` — all clean.
2. `npm test` — passes, including `domain/timer/timerEngine` and
   `domain/palette/paletteContrast`.
3. Focus tab renders correctly in the Expo preview: hero timer, scene backdrop, all 6
   modes switch the planned duration correctly; the other 4 tabs render their empty state
   without crashing.
4. **Real-device smoke tests on a real Android device** (a dev client build if Expo Go
   can't reproduce the native background behavior being tested):
   - Start a timer, lock/background the phone, foreground it — elapsed time reconciles
     correctly with no drift or double-counting.
   - Toggle sound layers and drag their volume in the mixer sheet — real audio plays,
     mixes, and ramps.
   - With a sound mix playing, lock the screen and background the app for several
     minutes — playback continues uninterrupted.
