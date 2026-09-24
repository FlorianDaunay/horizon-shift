# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/floriandaunay/horizon-shift/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/floriandaunay/horizon-shift/releases/tag/v0.1.0
