import { ACESFilmicToneMapping, Color, PCFShadowMap, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { Atmosphere } from "./atmosphere/Atmosphere";
import { Fireflies } from "./atmosphere/Fireflies";
import { LightPool } from "./atmosphere/LightPool";
import { AudioEngine } from "./audio/AudioEngine";
import { WATER_LEVEL } from "./config";
import { Interactions } from "./Interactions";
import { Progress } from "./Progress";
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
import { createSample } from "./world/generation/TerrainSampler";
import { Fish } from "./world/Fish";
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
  muted: boolean;
  /** In deep water. */
  swimming: boolean;
  /** Head under water. */
  underwater: boolean;
  /** 0..1, air left while diving. */
  oxygen: number;
  /** Crystal shards collected (they fuel the glide). */
  shards: number;
  gliding: boolean;
  /** What pressing E would do, or null. */
  prompt: string | null;
}

export interface GameEvents {
  stats: GameStats;
  /** The pointer was captured (playing) or released (menu). */
  pointerLock: boolean;
  /** A short message to show for a moment. */
  toast: string;
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
  private readonly audio = new AudioEngine();
  private readonly fireflies = new Fireflies();
  private readonly lights: LightPool;
  private readonly fish: Fish;
  private readonly progress: Progress;
  private readonly interactions: Interactions;
  private readonly moodSample = createSample();
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
  private moodTimer = 1;
  private clock = 0;
  private muted = false;
  /** Smoothed 0..1 factors from the surroundings: how many fireflies, how windy. */
  private fireflyLevel = 0;
  private windiness = 0;
  /** 0 above water .. 1 with the camera under the surface (smoothed, so crossing the surface fades). */
  private waterAmount = 0;

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
    this.scene.add(this.avatar.root, this.fireflies.points);
    this.lights = new LightPool(this.scene, this.world, 2);
    this.fish = new Fish(this.scene, (x, z) => this.world.heightAt(x, z));
    this.progress = new Progress(this.world.taken);
    this.progress.load(this.settings.seed);
    this.interactions = new Interactions(
      this.world,
      this.player,
      this.audio,
      this.atmosphere,
      this.progress,
      () => this.settings.seed,
      (message) => this.events.emit("toast", message)
    );
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
    this.audio.start(); // audio may only start from a user gesture
    this.pointerLock.request();
  }

  applySettings(next: Partial<GameSettings>): void {
    const previous = this.settings;
    this.settings = { ...previous, ...next };
    const s = this.settings;

    this.input.preferences = { lookSensitivity: s.lookSensitivity, invertY: s.invertY };
    this.followCamera.baseFov = s.fov;
    this.atmosphere.dayLengthMinutes = s.dayLengthMinutes;
    this.audio.setVolumes({ music: s.musicVolume, sfx: s.sfxVolume });

    if (s.quality !== previous.quality) {
      if (s.quality === "auto") this.adaptive.set(profileIndex(this.profile.id));
      else this.applyProfile(QUALITY_PROFILES[profileIndex(s.quality)]);
    }
    if (s.seed !== previous.seed) {
      this.world.reseed(s.seed);
      this.progress.load(s.seed);
      this.ready = false;
      this.respawn();
    }
  }

  /** Sets the time of day (hours since midnight, 0-24). */
  setTimeOfDay(hour: number): void {
    this.atmosphere.setHour(hour);
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
    this.fireflies.setPixelRatio(pixelRatio);
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
    // While resting by a fire, time flies and the controls are frozen.
    const active = playing && !this.interactions.resting;
    const activeInput = active ? input : this.idleInput;

    if (playing) {
      this.player.canGlide = this.progress.shards > 0;
      this.player.update(dt, activeInput, this.followCamera.yaw);
      this.playSounds();
      if (this.player.glideTime > 0) {
        const glided = this.player.glideTime;
        this.player.glideTime = 0;
        if (this.progress.spendGlide(glided)) {
          this.progress.save(this.settings.seed);
          if (this.progress.shards === 0) this.events.emit("toast", "Out of shards: no more gliding");
        }
      }
      if (input.buttons.resetCamera.pressed) this.followCamera.alignBehind(this.player.heading);
      if (input.buttons.toggleMute.pressed) {
        this.muted = !this.muted;
        this.audio.setVolumes({ muted: this.muted });
      }
    }
    this.interactions.update(dt, playing, input);

    const { position } = this.player;
    const daylight = this.atmosphere.daylight;
    const night = 1 - daylight;
    this.clock += dt;

    this.followCamera.update(dt, activeInput, position, this.player.sprinting);
    this.updateWater(dt);
    this.world.update(dt, position, daylight);
    this.atmosphere.update(playing ? dt : 0, position, this.camera);
    (this.scene.background as Color).copy(this.atmosphere.fog.color); // what shows when the sky is hidden under water
    this.avatar.update(playing ? dt : 0, this.player, night);
    this.lights.update(dt, position, night);
    this.fish.update(dt, this.clock, position, this.player.swimming);
    this.updateMood(dt, position.x, position.z);
    this.fireflies.update(this.clock, position, this.fireflyLevel * night * night * (1 - this.waterAmount));
    this.audio.update(dt, { daylight, altitude: position.y, windiness: this.windiness * (1 - this.waterAmount), paused: !playing });
    this.post.setUnderwater(this.waterAmount, this.clock);

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

  /** Smooths the "camera is under water" state, then applies it to the fog, sky, picture and sound. */
  private updateWater(dt: number): void {
    const camera = this.camera.position;
    const submerged = camera.y < WATER_LEVEL - 0.03 && this.world.heightAt(camera.x, camera.z) < WATER_LEVEL;
    this.waterAmount += ((submerged ? 1 : 0) - this.waterAmount) * Math.min(1, dt * 10);
    this.atmosphere.setUnderwater(this.waterAmount);
    this.audio.setUnderwater(this.waterAmount > 0.5);
  }

  /** Footsteps, jumps and landings, with the sound of whatever the player is on. */
  private playSounds(): void {
    const { events, position } = this.player;
    if (events.splash > 0) this.audio.splash(events.splash);
    if (events.stroke) this.audio.stroke();
    if (!events.step && !events.jump && events.land === 0) return;
    const surface = this.player.onObject ? "stone" : this.player.inWater ? "water" : this.world.surfaceAt(position.x, position.z);
    if (events.jump) this.audio.jump(surface);
    if (events.land > 0) this.audio.land(surface, events.land);
    if (events.step) this.audio.footstep(surface, this.player.sprinting);
  }

  /** A few times a second, works out what the surroundings mean for fireflies and wind. */
  private updateMood(dt: number, x: number, z: number): void {
    this.moodTimer += dt;
    if (this.moodTimer < 0.2) return;
    const elapsed = this.moodTimer;
    this.moodTimer = 0;
    const { weights, mountain } = this.world.sampleTerrain(x, z, this.moodSample);
    // forest, desert, snow, swamp
    const fireflies = Math.min(1, weights[0] * 0.9 + weights[3] * 1.3 + weights[1] * 0.1);
    const wind = weights[1] * 0.3 + weights[2] * 0.35 + mountain * 0.3;
    const k = Math.min(1, elapsed * 1.5);
    this.fireflyLevel += (fireflies - this.fireflyLevel) * k;
    this.windiness += (wind - this.windiness) * k;
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
      muted: this.muted,
      swimming: this.player.swimming,
      underwater: this.player.headUnderwater,
      oxygen: this.player.oxygen,
      shards: this.progress.shards,
      gliding: this.player.gliding,
      prompt: this.interactions.prompt,
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
    this.audio.dispose();
    this.fireflies.dispose();
    this.lights.dispose();
    this.fish.dispose();
    this.post.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
