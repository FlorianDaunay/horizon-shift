# Horizon Shift

A procedural 3D nature exploration game that runs entirely in your browser. No backend, no server-side code:
the build is a static site hosted on GitHub Pages.

Walk (third person) through forests, deserts, frozen peaks and swamps that are generated around you as you
move, find ruins, stone towers and caves, and watch the sun cross the sky.

## Controls

| Input                      | Action                                              |
| -------------------------- | --------------------------------------------------- |
| `W` `A` `S` `D`            | Move (physical keys, so it is `Z` `Q` `S` `D` on AZERTY) |
| Mouse                      | Turn the camera around your character               |
| Arrow keys                 | Turn the camera with the keyboard                   |
| `Shift`                    | Sprint                                              |
| `Space`                    | Jump                                                |
| Mouse wheel, `-` / `+`     | Zoom the camera                                     |
| `R`                        | Put the camera back behind you                      |
| `Esc`                      | Release the mouse and open the menu                 |

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev          # dev server with hot reload
npm test             # unit tests (vitest)
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run build        # type-check, then production build into dist/
npm run preview      # serve dist/ locally
```

Run a single test file with `npx vitest run tests/terrain.test.ts`, or a single test by name with
`npx vitest run -t "is deterministic"`.

In dev mode the running game is available in the console as `window.__game`
(for example `__game.teleport(500, -300)`).

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`: lint, type-check, tests, build, then publish `dist/`
to GitHub Pages. One-time setup in the repository: **Settings → Pages → Source: GitHub Actions**.

The build uses a relative base path (`base: "./"`), so it works both on a project site
(`https://<user>.github.io/horizon-shift/`) and on a custom domain.

## Versioning and releases

The project follows [Semantic Versioning](https://semver.org/); notable changes are listed in
[CHANGELOG.md](CHANGELOG.md). The version shown in the menu footer comes from `package.json`, together with
the commit it was built from.

To cut a release:

1. Move the `[Unreleased]` entries of `CHANGELOG.md` under a new `## [x.y.z] - date` heading and commit.
2. `npm version patch` (or `minor` / `major`). This bumps `package.json` and creates the `vx.y.z` tag.
3. `git push --follow-tags`.

`.github/workflows/release.yml` checks that the tag matches `package.json`, then publishes a GitHub release
with the matching changelog section and a zip of the build.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organised and how to extend it
(new biomes, new vegetation, new input devices, new quality levels).

```
src/
  game/        the game engine: no React, no DOM UI
    input/       device-independent actions, input sources (keyboard + mouse today)
    player/      character physics, avatar, third-person camera
    world/       chunk streaming, workers, procedural generation, instanced models
    atmosphere/  sky shader, day/night cycle, sun, fog
    rendering/   post-processing
    performance/ FPS monitor, adaptive quality, quality profiles
  ui/          React interface: menu, HUD, settings
  themes/      design tokens and 50+ themes (Tailwind + CSS variables)
tests/         unit tests
```
