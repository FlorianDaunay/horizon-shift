# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-09-25

### Added

- **Collision** on trees, rocks, cacti, towers, walls, pillars, stones and tents. Low rocks and stones can be
  stepped onto, taller ones jumped onto.
- **Eight kinds of structures** (was three): ruins, stone towers and caves now share the world with standing-stone
  circles, obelisks, campsites, shrines and ancient arches, chosen by biome.
- **Floating islands** with trees, crystals and lanterns, reached by climbing a spiral of floating stones.
  They are deliberately rare, so the sky stays open.
- **Light in the dark**: torches, campfires, lanterns, glowing crystals and mushrooms that shine at night; a
  fixed pool of real lights that always sits on the nearest sources; fireflies in forests and swamps; and a
  lantern on the character's staff.
- **Sound**, all synthesised (no downloads): a relaxed lo-fi loop, wind that follows altitude and biome, and
  footsteps that depend on the ground (grass, sand, snow, mud, rock, stone, water) plus jump and landing sounds.
  Music and effects volumes in the settings, `M` to mute.
- A new character, the hooded wanderer, with a flowing scarf, glowing eyes and a lantern staff.
- Baked ambient occlusion on terrain and foliage for better depth at no runtime cost.

### Changed

- Jumping is higher (about 2 m), and a sprint jump keeps its speed in the air.
- The physics runs in sub-steps so a long frame can no longer tunnel through thin stones.
- Chunk keys are numbers instead of strings (no string allocation while querying collisions).


## [0.1.0] - 2026-09-24

First playable version.

### Added

- Third-person exploration with classic keyboard and mouse controls (WASD/ZQSD, Shift, Space, pointer-locked
  camera, wheel zoom), built on a device-independent input layer so other devices can be added later.
- Streamed procedural world: 64 m chunks around the player, three LOD rings with skirts, terrain and
  vegetation generated in Web Workers.
- Four blended biomes (forest, desert, snow mountains, swamp), water, and deterministic points of interest
  (ruins, stone towers, caves).
- Instanced, pooled vegetation and rocks with wind sway; frustum culling on every mesh.
- Dynamic sky with a day/night cycle, sun and moon, stars, distance fog and shadows that follow the player.
- Post-processing (color grade, vignette, tone mapping) on a multisampled HDR pipeline.
- Adaptive quality: view distance, vegetation, shadow resolution, render scale and post-processing scale
  down automatically below 50 FPS and recover slowly when performance allows.
- React + Tailwind interface (menu, HUD, settings) driven by the theme system, with dozens of themes.
- GitHub Actions for CI, deployment to GitHub Pages, and tagged releases.

[Unreleased]: https://github.com/floriandaunay/horizon-shift/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/floriandaunay/horizon-shift/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/floriandaunay/horizon-shift/releases/tag/v0.1.0
