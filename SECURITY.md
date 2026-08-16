# Security Policy

## Scope

FocusRitual is a fully offline mobile app: no accounts, no backend, no API
keys, no analytics, no network calls. All data stays on-device (locally, via
`expo-sqlite` from Phase 2 onward). This significantly limits the realistic
attack surface compared to a networked app, but local data handling
(wallpaper imports, notification scheduling, SQLite storage) and dependency
supply-chain issues are still in scope.

## Supported versions

This project has not yet reached a `1.0.0` release. Security fixes are only
made against the `main` branch.

| Version | Supported |
| ------- | --------- |
| `main`  | ✅        |

## Reporting a vulnerability

This repository is private. If you have access to it and find a security
issue:

1. Preferably, open a [GitHub Security Advisory](../../security/advisories/new)
   on this repository (private by default, doesn't disclose the issue
   publicly).
2. Otherwise, open a regular issue describing the concern — since the repo is
   private, this is not a public disclosure.

Please include:

- A description of the issue and its potential impact.
- Steps to reproduce, or a minimal example.
- The affected file(s)/commit, if known.

Don't include real personal data in reproduction steps.

## Response

As a personal project, there's no formal SLA, but reports are read and
triaged promptly. Fixes for confirmed issues are prioritized over other
Phase-roadmap work.
