import { useState } from "react";
import { ControlsPanel } from "./ControlsPanel";
import { useGame } from "./GameContext";
import { Button, cx } from "./kit";
import { SettingsPanel } from "./SettingsPanel";
import { useRuntime } from "./stores";

type Tab = "home" | "settings" | "controls";

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Play" },
  { id: "settings", label: "Settings" },
  { id: "controls", label: "Controls" },
];

/** Start / pause screen drawn over the live world. */
export function Menu() {
  const game = useGame();
  const stats = useRuntime((s) => s.stats);
  const [tab, setTab] = useState<Tab>("home");
  const ready = stats?.ready ?? false;
  const started = useRuntime((s) => s.started);

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-canvas/50 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-xl rounded-card border bg-surface/95 shadow-overlay"
        style={{ backdropFilter: "var(--effect-surface-backdrop)" }}
      >
        <header className="flex items-center justify-between gap-4 border-b p-5">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0" aria-hidden>
              <rect width="32" height="32" rx="8" className="fill-accent" />
              <path d="M4 23 12 11l5 7 3-4 8 9z" className="fill-accent-foreground" />
            </svg>
            <div>
              <h1 className="text-lg font-semibold leading-tight text-text-primary">Horizon Shift</h1>
              <p className="text-xs text-text-muted">Procedural nature exploration</p>
            </div>
          </div>
          <nav className="flex gap-1" aria-label="Menu">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={tab === id}
                className={cx(
                  "rounded-control px-3 py-1.5 text-sm transition-colors",
                  tab === id ? "bg-accent/15 text-text-primary" : "text-text-secondary hover:bg-surface-hover"
                )}
              >
                {id === "home" && started ? "Resume" : label}
              </button>
            ))}
          </nav>
        </header>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {tab === "home" && (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-text-secondary">
                Wander through forests, deserts, frozen peaks and swamps that are generated as you walk. Find ruins,
                towers and caves hidden in the wild. The world is different for every seed.
              </p>
              {ready ? (
                <Button variant="primary" className="w-full py-3 text-base" onClick={() => game?.requestPlay()} autoFocus>
                  {started ? "Resume" : "Play"}
                </Button>
              ) : (
                <LoadingBar loaded={stats?.chunksLoaded ?? 0} />
              )}
              <p className="text-center text-xs text-text-muted">
                Your mouse is captured while playing. Press <span className="font-mono">Esc</span> to get it back.
              </p>
            </div>
          )}
          {tab === "settings" && <SettingsPanel />}
          {tab === "controls" && <ControlsPanel />}
        </div>

        <footer className="flex items-center justify-between border-t px-5 py-3 text-xs text-text-muted">
          <span>
            v{__APP_VERSION__} · {__COMMIT__}
          </span>
          {stats && <span className="font-mono">{Math.round(stats.fps)} fps</span>}
        </footer>
      </div>
    </div>
  );
}

function LoadingBar({ loaded }: { loaded: number }) {
  const progress = Math.min(1, loaded / 13);
  return (
    <div className="space-y-2" role="status">
      <div className="flex justify-between text-sm text-text-secondary">
        <span>Generating the world…</span>
        <span className="font-mono text-text-muted">{Math.round(progress * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-pill border bg-canvas">
        <div className="h-full bg-accent transition-all" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
