# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Horizon Shift: a static, pure front-end 3D procedural exploration game (three.js + React + Tailwind + Vite),
deployed to GitHub Pages. There is no backend. See `README.md` for the player-facing overview and
`docs/ARCHITECTURE.md` for the design and how to extend it.

## Commands

```bash
npm run dev         # Vite dev server (exposes window.__game in the console)
npm run build       # tsc --noEmit, then production build into dist/
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest run (tests live in tests/)
npx vitest run tests/terrain.test.ts   # one file
npx vitest run -t "is deterministic"   # one test by name
```

Before finishing a change, run lint, typecheck, tests and build: CI runs exactly those.

## Architecture in brief

- `src/game/` is the engine: plain TypeScript + three.js, **no React**. `Game.ts` is the composition root and the
  only file that wires systems together. The UI talks to it through `Game.applySettings`, `Game.requestPlay`
  and `Game.events` only.
- `src/game/world/generation/` must stay **pure** (no DOM, no three.js): it runs in the terrain Web Worker and
  on the main thread (physics, camera collision, tests). The world is a pure function of the seed.
- Input is device-independent: gameplay reads `InputFrame` (semantic actions from `input/actions.ts`), never
  keys. New devices (gamepad, touch) are new `InputSource` implementations registered in `Game`.
- `src/themes/` is a token-based theme system supplied by the project owner (auto-registers every file in
  `themes/definitions`). UI must use its Tailwind classes (`bg-surface`, `text-text-muted`, `rounded-card`,
  ...) instead of hard-coded colors so every theme works.
- Quality levels live in `game/performance/quality.ts`; `AdaptiveQuality` picks one from the frame rate.

## Conventions

- Keep hot paths allocation-free (frame loop, chunk streaming): reuse vectors, pool meshes.
- Anything that must be identical between the worker and the main thread goes in `world/generation/`.
- Version: SemVer in `package.json`, notes in `CHANGELOG.md` (Keep a Changelog). Releases are cut by tagging
  `vX.Y.Z` (see README, "Versioning and releases"). Update the changelog with user-visible changes.
- `.scratch/` is git-ignored and used for throwaway scripts.
