import type { ReactNode } from "react";
import { Kbd } from "./kit";

const ROWS: { keys: ReactNode; action: string }[] = [
  { keys: <><Kbd>W</Kbd><Kbd>A</Kbd><Kbd>S</Kbd><Kbd>D</Kbd></>, action: "Move (physical keys: ZQSD on AZERTY)" },
  { keys: <span className="text-xs text-text-secondary">Mouse</span>, action: "Turn the camera around your character" },
  { keys: <><Kbd>←</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd><Kbd>→</Kbd></>, action: "Turn the camera with the keyboard" },
  { keys: <Kbd>Shift</Kbd>, action: "Sprint" },
  { keys: <Kbd>Space</Kbd>, action: "Jump" },
  { keys: <span className="text-xs text-text-secondary">Wheel</span>, action: "Zoom the camera (also − and +)" },
  { keys: <Kbd>R</Kbd>, action: "Put the camera back behind you" },
  { keys: <Kbd>Esc</Kbd>, action: "Pause and open the menu" },
];

export function ControlsPanel() {
  return (
    <ul className="divide-y divide-border">
      {ROWS.map((row) => (
        <li key={row.action} className="flex items-center justify-between gap-4 py-2.5">
          <span className="text-sm text-text-secondary">{row.action}</span>
          <span className="flex shrink-0 items-center gap-1">{row.keys}</span>
        </li>
      ))}
    </ul>
  );
}
