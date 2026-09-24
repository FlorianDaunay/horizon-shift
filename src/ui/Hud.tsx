import { useEffect, useState, type ReactNode } from "react";
import { BIOME_LABELS, type GameStats } from "../game";
import { Kbd } from "./kit";
import { useSettings } from "./stores";

const POI_LABELS: Record<string, string> = { ruins: "Ruins", tower: "Stone tower", cave: "Cave" };

const formatHour = (hour: number) => {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const Chip = ({ children }: { children: ReactNode }) => (
  <div
    className="rounded-control border bg-surface/80 px-3 py-1.5 text-sm text-text-primary shadow-card"
    style={{ backdropFilter: "var(--effect-surface-backdrop)" }}
  >
    {children}
  </div>
);

/** Heads-up display shown while playing. */
export function Hud({ stats }: { stats: GameStats }) {
  const showDebug = useSettings((s) => s.settings.showDebug);
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setHintVisible(false), 9000);
    return () => window.clearTimeout(timer);
  }, []);

  const poi = stats.nearestPoi && stats.nearestPoi.distance < 140 ? stats.nearestPoi : null;

  return (
    <div className="pointer-events-none fixed inset-0 select-none">
      <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
        <Chip>
          <span className="font-medium">{BIOME_LABELS[stats.biome]}</span>
          <span className="ml-3 font-mono text-text-secondary">{formatHour(stats.hour)}</span>
        </Chip>
        {poi && (
          <Chip>
            <span className="text-accent">◆</span> {POI_LABELS[poi.type] ?? poi.type}{" "}
            <span className="font-mono text-text-secondary">{Math.round(poi.distance)} m</span>
          </Chip>
        )}
      </div>

      <div className="absolute right-4 top-4 text-right">
        <Chip>
          <span className="font-mono">{Math.round(stats.fps)}</span> <span className="text-text-muted">fps</span>
          {stats.autoQuality && <span className="ml-2 text-xs text-text-muted">auto · {stats.quality}</span>}
        </Chip>
        {showDebug && (
          <div
            className="mt-2 rounded-control border bg-surface/80 px-3 py-2 font-mono text-xs leading-relaxed text-text-secondary shadow-card"
            style={{ backdropFilter: "var(--effect-surface-backdrop)" }}
          >
            <div>{stats.frameMs.toFixed(1)} ms · quality {stats.quality}</div>
            <div>
              chunks {stats.chunksLoaded} (+{stats.chunksPending})
            </div>
            <div>
              {stats.drawCalls} draws · {(stats.triangles / 1000).toFixed(0)}k tris
            </div>
            <div>
              {stats.position.map((v) => v.toFixed(0)).join(", ")}
            </div>
          </div>
        )}
      </div>

      <div
        className={`absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 text-xs text-text-secondary transition-opacity duration-700 ${
          hintVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <Chip>
          <span className="flex items-center gap-2">
            <Kbd>W</Kbd><Kbd>A</Kbd><Kbd>S</Kbd><Kbd>D</Kbd> move
            <span className="text-text-muted">·</span>
            <Kbd>Shift</Kbd> sprint
            <span className="text-text-muted">·</span>
            <Kbd>Space</Kbd> jump
            <span className="text-text-muted">·</span>
            <Kbd>Esc</Kbd> menu
          </span>
        </Chip>
      </div>
    </div>
  );
}
