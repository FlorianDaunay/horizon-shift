import { themeToStyle, themes, useActiveTheme, useThemeStore } from "../themes";
import { Toggle, cx } from "./kit";

/** Grid of every registered theme, each previewed in its own colors, shape and shadows. */
export function ThemePicker() {
  const active = useActiveTheme();
  const followSystem = useThemeStore((s) => s.followSystem);
  const selectTheme = useThemeStore((s) => s.selectTheme);
  const setFollowSystem = useThemeStore((s) => s.setFollowSystem);

  return (
    <div className="space-y-3">
      <Toggle checked={followSystem} onChange={setFollowSystem} label="Match system light / dark" />
      <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {themes.map((theme) => {
          const selected = theme.id === active.id;
          return (
            <button
              key={theme.id}
              onClick={() => selectTheme(theme.id)}
              aria-pressed={selected}
              title={theme.description}
              style={themeToStyle(theme)}
              className={cx(
                "group relative flex flex-col gap-2 rounded-card border bg-canvas p-2 text-left font-sans",
                selected && "outline outline-2 outline-offset-2 outline-[rgb(var(--color-accent))]"
              )}
            >
              <span className="flex h-10 items-end gap-1 rounded-control border bg-surface p-1.5 shadow-card">
                <span className="h-full w-2/5 rounded-control bg-accent" />
                <span className="h-2/3 w-1/5 rounded-control bg-surface-hover" />
                <span className="h-1/3 w-1/5 rounded-control bg-success" />
              </span>
              <span className="truncate text-xs font-medium text-text-primary">{theme.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
