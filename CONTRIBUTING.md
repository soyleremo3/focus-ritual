# Contributing to FocusRitual

FocusRitual is a personal, offline-first Expo/React Native project. This guide
covers local setup, conventions, and how to get a change merged.

## Getting started

```bash
npm install
npm run start
```

Useful during development:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm test            # jest (jest-expo preset)
npm run test:coverage
```

All four should be clean before opening a pull request.

## Project conventions

- **Strict TypeScript.** `noUncheckedIndexedAccess` is on — array/object index
  reads are `T | undefined` unless narrowed.
- **Domain layer stays pure.** Code under `src/domain/` must not import
  React Native, Expo, or any I/O. It's the only directory with enforced test
  coverage (`npm run test:coverage`).
- **No new state-management surface without a reason.** `src/store/` is one
  small Zustand store per concern (see `README.md`), not a single mega-store.
- **Keep dependencies minimal.** Prefer composing existing primitives
  (`src/components/`) or a short custom implementation over adding a package.
  If you do add one, explain why in the PR description.
- **Restrained motion.** Animation communicates a state change; it doesn't
  decorate. See `src/theme/motion.ts` and the rule described in `README.md`.
- **Fully offline.** No accounts, no backend calls, no analytics, no paid
  services — ever. This is a hard constraint, not a Phase 1 simplification.

## Commit style

This repository uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

<optional body>
```

Common types: `feat`, `fix`, `docs`, `test`, `build`, `chore`, `refactor`.
Scope is usually a top-level `src/` directory (`domain`, `theme`, `store`,
`focus`, `app`) when the change is scoped to one.

Keep commits small and atomic — one logical change per commit. Prefer several
focused commits over one large one; it makes review and `git bisect` easier.

## Pull requests

1. Branch from `main`.
2. Keep the PR scoped to one feature or fix. Use the PR template.
3. Make sure `npm run typecheck`, `npm run lint`, and `npm test` all pass.
4. For UI changes, include a screenshot or a short screen recording.
5. Describe any manual testing you did (native builds, real-device checks for
   background audio/timer accuracy — see `README.md`'s Verification section).

## Reporting bugs / requesting features

Use the issue templates under `.github/ISSUE_TEMPLATE/`. For security issues,
see `SECURITY.md` instead of opening a public issue.
