# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] - 2026-09-26

### Added

- **Lakes** carved into the terrain, with a rippling water surface, dark teal lake beds, lily pads and reeds.
- **Swimming and diving**: deep water is swum (`Shift` swims faster), `C` dives and `Space` rises. There is
  air for about 30 seconds under water; when it runs out the water lifts you up. `Space` at the surface hops
  out onto docks, boats and banks. Underwater the sky gives way to dense teal fog, the picture wobbles and turns
  blue-green, and the sound goes muffled. Splashes and strokes are audible, and there are fish that avoid the
  shore and flee from swimmers.
- **Interactions** (`E`): collect crystal shards, open chests, ring bells, and rest by a campfire until dusk or
  dawn. Prompts appear on the HUD; used crystals and chests stay gone (saved per world seed).
- **Glide**: hold `Space` in the air to float down slowly. Each crystal shard pays for a few seconds.
- **Seven new structures**: windmill (with turning sails), old well, woodcutter's hut, graveyard, ancient tree,
  watchtower (climbable by a stair of planks) and a stilt-hut dock with a pier and a boat on lakes. Bells hang in
  arches, and chests are hidden at most structures.
- A swimming and a gliding pose for the character.

### Fixed

- A quick key tap on a slow frame is no longer lost (taps are latched until the next input poll).

### Changed

- Terrain colouring turns from mud into dark teal below the water line.
- Hopping out of the water is a full-strength jump.


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

[Unreleased]: https://github.com/floriandaunay/horizon-shift/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/floriandaunay/horizon-shift/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/floriandaunay/horizon-shift/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/floriandaunay/horizon-shift/releases/tag/v0.1.0
