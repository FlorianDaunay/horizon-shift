import { ACESFilmicToneMapping, Color, PCFShadowMap, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { Atmosphere } from "./atmosphere/Atmosphere";
import { Emitter } from "./core/Emitter";
import { createFrame } from "./input/actions";
import { InputManager } from "./input/InputManager";
import { KeyboardMouseSource } from "./input/KeyboardMouseSource";
import { PointerLock } from "./input/PointerLock";
import { AdaptiveQuality } from "./performance/AdaptiveQuality";
import { FpsMonitor } from "./performance/FpsMonitor";
import { QUALITY_PROFILES, profileIndex, type QualityLevel, type QualityProfile } from "./performance/quality";
import { PlayerAvatar } from "./player/PlayerAvatar";
import { PlayerController } from "./player/PlayerController";
import { ThirdPersonCamera } from "./player/ThirdPersonCamera";
import { PostProcessing } from "./rendering/PostProcessing";
import { DEFAULT_SETTINGS, type GameSettings } from "./settings";
import type { BiomeId } from "./world/generation/biomes";
import { findSpawn } from "./world/spawn";
import { World } from "./world/World";

/** A snapshot of the game for HUDs and debug overlays. */
export interface GameStats {
  fps: number;
  frameMs: number;
  quality: QualityLevel;
  autoQuality: boolean;
  biome: BiomeId;
  /** Hours since midnight. */
  hour: number;
  position: [number, number, number];
  chunksLoaded: number;
  chunksPending: number;
  drawCalls: number;
  triangles: number;
  nearestPoi: { type: string; distance: number } | null;
  /** True once the terrain around the player exists. */
  ready: boolean;
  locked: boolean;
}

export interface GameEvents {
  stats: GameStats;
  /** The pointer was captured (playing) or released (menu). */
  pointerLock: boolean;
}

const STATS_INTERVAL = 0.25;
const AUTO_START_LEVEL = profileIndex("medium");

/**
 * The composition root: creates the renderer, the world, the player and the systems around them,
 * runs the frame loop, and exposes a small API to the UI. It has no dependency on React; the UI
 * listens to `events` and calls the public methods.
 */
export class Game {
  readonly events = new Emitter<GameEvents>();

  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(70, 1, 0.3, 2500);
  private readonly atmosphere: Atmosphere;
  private readonly world: World;
  private readonly player: PlayerController;
  private readonly avatar = new PlayerAvatar();
  private readonly followCamera: ThirdPersonCamera;
  private readonly post: PostProcessing;
  private readonly input = new InputManager();
  private readonly pointerLock: PointerLock;
  private readonly fps = new FpsMonitor();
  private readonly adaptive = new AdaptiveQuality(AUTO_START_LEVEL, QUALITY_PROFILES.length);
  private readonly resizeObserver: ResizeObserver;
  private readonly idleInput = createFrame();

  private settings: GameSettings;
  private profile: QualityProfile;
  private ready = false;
  private lastTime = 0;
  private statsTimer = 0;

  constructor(private readonly container: HTMLElement, settings: GameSettings = DEFAULT_SETTINGS) {
    this.settings = { ...settings };
    this.profile = QUALITY_PROFILES[this.settings.quality === "auto" ? AUTO_START_LEVEL : profileIndex(this.settings.quality)];

    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.info.autoReset = false; // the composer renders several passes per frame
    this.renderer.domElement.style.display = "block";
    container.appendChild(this.renderer.domElement);
    this.scene.background = new Color(0x9ec9f2);

    this.pointerLock = new PointerLock(this.renderer.domElement);
    this.pointerLock.onChange((locked) => {
      if (!locked) this.input.reset();
      this.events.emit("pointerLock", locked);
    });
    this.input.register(new KeyboardMouseSource(this.pointerLock));

    this.world = new World(this.scene, this.profile, this.settings.seed);
    this.atmosphere = new Atmosphere(this.scene);
    this.player = new PlayerController(this.world);
    this.followCamera = new ThirdPersonCamera(this.camera, this.world);
    this.scene.add(this.avatar.root);
    this.avatar.root.traverse((o) => (o.receiveShadow = false));
    this.post = new PostProcessing(this.renderer, this.scene, this.camera);

    this.respawn();
    this.applySettings(this.settings);
    this.applyProfile(this.profile);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  /** Starts the frame loop. */
  start(): void {
    this.lastTime = performance.now();
    this.renderer.setAnimationLoop((now) => this.frame(now));
  }

  /** Captures the mouse and starts (or resumes) playing. Call from a click or key press. */
  requestPlay(): void {
    this.pointerLock.request();
  }

  applySettings(next: Partial<GameSettings>): void {
    const previous = this.settings;
    this.settings = { ...previous, ...next };
    const s = this.settings;

    this.input.preferences = { lookSensitivity: s.lookSensitivity, invertY: s.invertY };
    this.followCamera.baseFov = s.fov;
    this.atmosphere.dayLengthMinutes = s.dayLengthMinutes;

    if (s.quality !== previous.quality) {
      if (s.quality === "auto") this.adaptive.set(profileIndex(this.profile.id));
      else this.applyProfile(QUALITY_PROFILES[profileIndex(s.quality)]);
    }
    if (s.seed !== previous.seed) {
      this.world.reseed(s.seed);
      this.ready = false;
      this.respawn();
    }
  }

  /** Puts the player on the ground at (x, z) and the camera behind them. */
  teleport(x: number, z: number): void {
    this.player.spawn(x, z);
    this.followCamera.alignBehind(this.player.heading);
  }

  private respawn(): void {
    const { x, z } = findSpawn(this.world.sampler);
    this.teleport(x, z);
  }

  private applyProfile(profile: QualityProfile): void {
    this.profile = profile;
    this.world.applyQuality(profile);
    this.atmosphere.setViewDistance(this.world.viewDistance);
    this.atmosphere.setShadowSize(profile.shadowMapSize);
    this.post.enabled = profile.postProcessing;
    this.resize();
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, this.profile.pixelRatioCap);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
    this.post.setSize(width, height, pixelRatio);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private frame(now: number): void {
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0), 0.1);

    const input = this.input.update(dt); // always polled, so buffered mouse movement never piles up
    const playing = this.ready && this.pointerLock.locked;
    const activeInput = playing ? input : this.idleInput;

    if (playing) this.player.update(dt, input, this.followCamera.yaw);
    if (playing && input.buttons.resetCamera.pressed) this.followCamera.alignBehind(this.player.heading);

    this.followCamera.update(dt, activeInput, this.player.position, this.player.sprinting);
    this.world.update(dt, this.player.position);
    this.atmosphere.update(playing ? dt : 0, this.player.position, this.camera);
    this.avatar.update(playing ? dt : 0, this.player);

    if (!this.ready && this.world.isReady()) {
      this.ready = true;
      this.followCamera.alignBehind(this.player.heading);
    }

    this.renderer.info.reset();
    this.post.render(dt);

    if (this.settings.quality === "auto") {
      const level = this.adaptive.update(rawDt);
      if (level !== null) this.applyProfile(QUALITY_PROFILES[level]);
    }

    this.fps.tick(dt);
    this.statsTimer += dt;
    if (this.statsTimer >= STATS_INTERVAL) {
      this.statsTimer = 0;
      this.events.emit("stats", this.collectStats());
    }
  }

  private collectStats(): GameStats {
    const { position } = this.player;
    const poi = this.world.nearestPoi(position.x, position.z);
    const streaming = this.world.streamingStats;
    return {
      fps: this.fps.fps,
      frameMs: this.fps.frameMs,
      quality: this.profile.id,
      autoQuality: this.settings.quality === "auto",
      biome: this.world.biomeAt(position.x, position.z),
      hour: this.atmosphere.hour,
      position: [position.x, position.y, position.z],
      chunksLoaded: streaming.loaded,
      chunksPending: streaming.pending,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      nearestPoi: poi ? { type: poi.type, distance: poi.distance } : null,
      ready: this.ready,
      locked: this.pointerLock.locked,
    };
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.input.dispose();
    this.pointerLock.dispose();
    this.events.clear();
    this.world.dispose();
    this.atmosphere.dispose();
    this.avatar.dispose();
    this.post.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
