import { defineTheme } from "../define";
import type { ThemeDefinition } from "../types";

const shape: Partial<ThemeDefinition> = {
  radius: { control: "4px", tile: "6px", card: "8px" },
  borderWidth: "2px",
  density: 1.06,
  focus: { width: "3px", offset: "2px" },
  shadow: { card: "none", overlay: "0 0 0 2px currentColor" },
};

export default [
  defineTheme({
    id: "high-contrast",
    name: "High Contrast",
    description: "Pure black on white, 2px borders, bold focus. Accessibility first.",
    scheme: "light",
    colors: {
      canvas: "#FFFFFF",
      surface: "#FFFFFF",
      surfaceHover: "#E6E6E6",
      border: "#000000",
      textPrimary: "#000000",
      textSecondary: "#1A1A1A",
      textMuted: "#404040",
      accent: "#0033CC",
      success: "#006B1F",
      warning: "#8A4B00",
      danger: "#B00000",
      sidebarActive: "#0033CC",
      sidebarTextActive: "#FFFFFF",
    },
    ...shape,
  }),
  defineTheme({
    id: "high-contrast-dark",
    name: "High Contrast Dark",
    description: "Pure white on black, yellow accent, 2px borders. Accessibility first.",
    scheme: "dark",
    colors: {
      canvas: "#000000",
      surface: "#000000",
      surfaceHover: "#262626",
      border: "#FFFFFF",
      textPrimary: "#FFFFFF",
      textSecondary: "#F0F0F0",
      textMuted: "#CCCCCC",
      accent: "#FFFF00",
      success: "#00FF66",
      warning: "#FFB000",
      danger: "#FF6B6B",
      sidebarActive: "#FFFF00",
      sidebarTextActive: "#000000",
    },
    ...shape,
  }),
];
