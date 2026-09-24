export type QualityLevel = "high" | "medium" | "low" | "minimal";

/** Everything the adaptive controller can turn up or down. */
export interface QualityProfile {
  id: QualityLevel;
  label: string;
  /** How far terrain streams in, in chunks. */
  viewRadius: number;
  /** Radius (chunks) that gets trees, rocks and points of interest. */
  vegetationRadius: number;
  /** Radius (chunks) that also gets grass. */
  grassRadius: number;
  /** Shadow map side in pixels; 0 turns shadows off. */
  shadowMapSize: number;
  /** Upper bound on the render resolution multiplier. */
  pixelRatioCap: number;
  postProcessing: boolean;
}

/** Ordered from the best to the cheapest. */
export const QUALITY_PROFILES: readonly QualityProfile[] = [
  { id: "high", label: "High", viewRadius: 8, vegetationRadius: 6, grassRadius: 3, shadowMapSize: 2048, pixelRatioCap: 2, postProcessing: true },
  { id: "medium", label: "Medium", viewRadius: 6, vegetationRadius: 4, grassRadius: 2, shadowMapSize: 1024, pixelRatioCap: 1.5, postProcessing: true },
  { id: "low", label: "Low", viewRadius: 4, vegetationRadius: 3, grassRadius: 1, shadowMapSize: 512, pixelRatioCap: 1, postProcessing: false },
  { id: "minimal", label: "Minimal", viewRadius: 3, vegetationRadius: 2, grassRadius: 0, shadowMapSize: 0, pixelRatioCap: 0.75, postProcessing: false },
];

export const profileIndex = (id: QualityLevel) => QUALITY_PROFILES.findIndex((p) => p.id === id);
