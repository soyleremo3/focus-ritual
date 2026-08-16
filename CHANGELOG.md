# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project follows its own phase roadmap (see `README.md`) rather than
semantic versioning until a `1.0.0` release.

## [Unreleased]

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
