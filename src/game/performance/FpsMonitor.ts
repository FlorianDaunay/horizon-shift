/** Reports frames per second and average frame time over a sliding interval. */
export class FpsMonitor {
  fps = 0;
  frameMs = 0;
  private time = 0;
  private frames = 0;

  constructor(private readonly interval = 0.5) {}

  /** Feed one frame's duration in seconds; returns true when `fps` / `frameMs` were just refreshed. */
  tick(dt: number): boolean {
    this.time += dt;
    this.frames++;
    if (this.time < this.interval) return false;
    this.fps = this.frames / this.time;
    this.frameMs = (this.time / this.frames) * 1000;
    this.time = 0;
    this.frames = 0;
    return true;
  }
}
