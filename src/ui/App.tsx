import { GameHost } from "./GameContext";
import { Hud } from "./Hud";
import { Menu } from "./Menu";
import { useRuntime } from "./stores";

function Overlay() {
  const locked = useRuntime((s) => s.locked);
  const stats = useRuntime((s) => s.stats);
  const error = useRuntime((s) => s.error);

  if (error) return <ErrorScreen message={error} />;
  if (locked && stats) return <Hud stats={stats} />;
  return <Menu />;
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-canvas p-6">
      <div className="max-w-md space-y-3 rounded-card border bg-surface p-6 shadow-overlay">
        <h1 className="text-lg font-semibold text-danger">Horizon Shift could not start</h1>
        <p className="text-sm text-text-secondary">
          The game needs WebGL 2. Make sure hardware acceleration is enabled in your browser, then reload.
        </p>
        <p className="font-mono text-xs text-text-muted">{message}</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <GameHost>
      <Overlay />
    </GameHost>
  );
}
