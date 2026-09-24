# Architecture

Horizon Shift is split into a **game** (`src/game`, plain TypeScript + three.js, no React) and a **UI**
(`src/ui`, React + Tailwind). They meet at a narrow seam: the UI calls a few methods on `Game` and listens to
its events; the game knows nothing about React.

```
UI (React)  ──settings / requestPlay()──▶  Game  ──events: stats, pointerLock──▶  UI
                                             │
        ┌──────────┬───────────┬─────────────┼────────────┬───────────────┐
      input      player       world      atmosphere   rendering     performance
```

`Game` (`src/game/Game.ts`) is the composition root: it builds the systems, runs the frame loop and is the only
place where they are wired together. Each frame runs in a fixed order: input → player → camera → world
streaming → atmosphere → avatar → render → adaptive quality → stats.

## Input (`src/game/input`)

Gameplay reads **semantic actions**, never keys.

- `actions.ts` defines the vocabulary: axes (`moveX`, `moveY`, `lookX`, `lookY`, `zoom`) and buttons
  (`jump`, `sprint`, `resetCamera`), with documented ranges and units.
- An `InputSource` (`InputSource.ts`) is a device. It adds its contribution to an `InputSample` once per frame.
  `KeyboardMouseSource` is the only one today.
- `InputManager` merges all sources into one `InputFrame` (buttons get `down` / `pressed` / `released`), and
  applies the player's preferences (sensitivity, inverted Y).
- Key layout lives in data (`bindings.ts`) using `KeyboardEvent.code`, so it is layout independent.

**Adding a gamepad (or touch)**: write `GamepadSource implements InputSource` that reads the Gamepad API in
`poll(dt, sample)` and adds sticks to `moveX/moveY/lookX/lookY` (look values are radians *per frame*, so
multiply a stick by a turn rate and `dt`) and buttons to `jump/sprint/...`; then
`input.register(new GamepadSource())` in `Game`. Nothing in `player/` or `world/` changes. Pointer lock is
only relevant to the mouse; a gamepad source would also need the "playing" gate in `Game.frame` to consider
it (today: `pointerLock.locked`).

## Player (`src/game/player`)

- `PlayerController`: walking physics on the terrain (camera-relative movement, gravity, jump, steep-slope and
  deep-water blocking, wading). Depends only on a `Ground` (`heightAt`) and an `InputFrame`.
- `ThirdPersonCamera`: orbit-follow camera. The boom shortens when terrain gets between the camera and the
  player and the camera never goes underground.
- `PlayerAvatar`: procedural low-poly character animated from controller state.

## World (`src/game/world`)

The world is a pure function of a seed.

- `generation/` is **pure code (no DOM, no three.js)** shared by the workers and the main thread:
  - `TerrainSampler`: `height(x, z)` and biome weights from layered simplex noise. The main thread uses it for
    physics; workers use it for meshing. Same seed, same world, no shared memory.
  - `chunkMesh`: vertex buffers (positions, normals, biome colors) and cached index buffers per LOD, with
    skirts to hide cracks between LOD levels.
  - `scatter` and `poi`: deterministic vegetation and points of interest (one per chunk at most, kept away from
    the chunk borders so they never straddle two chunks). Instances are placed on the **rendered** mesh
    (`surfaceHeightFn`), not on the true terrain, so they never float at coarse LODs.
  - `generateChunk`: the worker's whole job.
- `ChunkManager` decides which chunks should exist (radius, LOD rings with hysteresis, vegetation and grass
  radii), asks a `WorkerPool` for them nearest-first, and shows results within a per-frame time budget.
- `ChunkView` / `ChunkViewFactory` fill **pooled** terrain meshes (one pool per LOD) and **pooled**
  `InstancedMesh`es (one pool per kind) from worker results, so streaming does not allocate GPU objects.
  Culling volumes are set by hand (an `InstancedMesh` would otherwise scan every instance).
- `instances/kinds.ts` lists everything drawn as instances and its per-chunk capacity; `instances/models.ts`
  builds the geometry and materials (with wind sway injected into the vertex shader).

**Adding a biome**: add its id and label in `generation/biomes.ts`; give it an affinity, a height profile
(`TerrainSampler.sample`), a ground color (`terrainColor.ts`) and vegetation rules (`scatter.ts`).

**Adding vegetation or a POI piece**: add the id and capacity to `instances/kinds.ts`, a model to
`instances/models.ts`, and emit it from `scatter.ts` or `poi.ts`.

## Atmosphere and rendering

- `Atmosphere`: day/night cycle, sky palette by sun elevation, sun and moon lights, hemisphere light, fog whose
  color always matches the horizon (this is what hides chunk pop-in), and a shadow frustum that follows the
  player, snapped to shadow-map texels.
- `sky.ts`: gradient dome shader with sun, moon and stars, pinned to the far plane.
- `PostProcessing`: multisampled HDR render target → color grade + vignette shader → tone mapping and sRGB
  output. Disabled on the lowest quality levels.

## Performance

- `FpsMonitor` measures; `AdaptiveQuality` decides (pure and unit-tested): drop one level after two seconds
  under 50 FPS, recover after ten good seconds, ignore stalls (background tab), and stop retrying a level
  that keeps failing.
- `quality.ts` defines what each level means (view radius, vegetation and grass radius, shadow map size, render
  scale, post-processing). Adding a level is adding a row.

## UI and themes

`src/themes` is a token-based theme system. Every theme is one file in `src/themes/definitions` (auto
registered); tokens become CSS variables and Tailwind classes (`bg-surface`, `text-text-muted`,
`rounded-card`, `shadow-overlay`, ...). UI components only use those classes, so all themes work everywhere.
Player options live in a persisted zustand store (`ui/stores.ts`) and are forwarded to the game with
`Game.applySettings`.

## Known limitations

- The player collides with the terrain and water only; trees, rocks and POIs are not solid yet.
- Worker result buffers are allocated per chunk and copied into pooled GPU buffers; recycling them back to
  the workers would remove the remaining allocation.
- Vegetation instances are per chunk (one `InstancedMesh` per kind and chunk), not global. This keeps
  culling and streaming simple; a global instance buffer would cut draw calls further.
