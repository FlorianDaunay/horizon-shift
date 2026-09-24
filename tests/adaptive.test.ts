import { describe, expect, it } from "vitest";
import { AdaptiveQuality } from "../src/game/performance/AdaptiveQuality";

/** Runs `seconds` of frames at a constant `fps`, returning every level change. */
function run(quality: AdaptiveQuality, fps: number, seconds: number): number[] {
  const changes: number[] = [];
  for (let i = 0; i < seconds * fps; i++) {
    const change = quality.update(1 / fps);
    if (change !== null) changes.push(change);
  }
  return changes;
}

describe("AdaptiveQuality", () => {
  it("degrades when FPS stays under 50", () => {
    const q = new AdaptiveQuality(0, 4);
    expect(run(q, 30, 10)[0]).toBe(1);
  });

  it("keeps stepping down while performance stays poor, but never past the last level", () => {
    const q = new AdaptiveQuality(0, 3);
    run(q, 20, 60);
    expect(q.current).toBe(2);
  });

  it("does nothing at a healthy frame rate", () => {
    const q = new AdaptiveQuality(1, 4);
    expect(run(q, 60, 8)).toEqual([]);
  });

  it("recovers slowly once performance is good", () => {
    const q = new AdaptiveQuality(2, 4);
    expect(run(q, 60, 8)).toEqual([]);
    expect(run(q, 60, 10)).toEqual([1]);
  });

  it("ignores stalls such as a background tab", () => {
    const q = new AdaptiveQuality(0, 4);
    for (let i = 0; i < 20; i++) expect(q.update(2)).toBeNull();
  });

  it("stops raising a level that keeps failing", () => {
    const q = new AdaptiveQuality(1, 4);
    run(q, 60, 20); // raised to 0
    expect(q.current).toBe(0);
    run(q, 25, 7); // settle (4s) + two slow seconds: fails at 0, drops back to 1
    expect(q.current).toBe(1);
    run(q, 60, 40); // healthy again, but raising is blocked for a while
    expect(q.current).toBe(1);
  });
});
