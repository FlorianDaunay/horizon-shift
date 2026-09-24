import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Game } from "../game";
import { useRuntime, useSettings } from "./stores";

const GameContext = createContext<Game | null>(null);

/** The running game, or `null` until it has been created. */
export const useGame = () => useContext(GameContext);

/**
 * Creates the game inside a full-screen container, forwards its events to the runtime store and
 * pushes settings changes into it. The UI never reaches into the game's internals.
 */
export function GameHost({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let instance: Game;
    try {
      instance = new Game(element, useSettings.getState().settings);
    } catch (error) {
      useRuntime.setState({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
    const offStats = instance.events.on("stats", (stats) => useRuntime.setState({ stats }));
    const offLock = instance.events.on("pointerLock", (locked) =>
      useRuntime.setState((state) => ({ locked, started: state.started || locked }))
    );
    const offToast = instance.events.on("toast", (text) => useRuntime.setState({ toast: { id: Date.now(), text } }));
    const offSettings = useSettings.subscribe((state) => instance.applySettings(state.settings));
    instance.start();
    if (import.meta.env.DEV) (window as unknown as { __game?: Game }).__game = instance; // handy in the console
    setGame(instance);

    return () => {
      offStats();
      offLock();
      offToast();
      offSettings();
      instance.dispose();
      setGame(null);
    };
  }, []);

  return (
    <GameContext.Provider value={game}>
      <div ref={container} className="fixed inset-0" />
      {children}
    </GameContext.Provider>
  );
}
