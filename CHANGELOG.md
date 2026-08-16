# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project follows its own phase roadmap (see `README.md`) rather than
semantic versioning until a `1.0.0` release.

## [Unreleased] — Phase 1: Architecture, Design System, Focus Screen Prototype

### Added

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

### Fixed

- Disabled the `reactCompiler` experiment — it broke live re-renders against
  the external Zustand store, freezing the timer display.
- Clamped the timer ring's SVG radius against a zero-width first layout pass.
- Rebuilt the sound mixer sheet's bottom-sheet layout with explicit
  `flex`/`justifyContent` instead of relying on implicit `Modal` behavior.

[Unreleased]: https://github.com/soyleremo3/focus-ritual/commits/main
