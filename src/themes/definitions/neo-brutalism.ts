import { defineTheme } from "../define";
import type { ThemeDefinition } from "../types";

const shape: Partial<ThemeDefinition> = {
  radius: { control: "0px", tile: "0px", card: "0px", pill: "0px" },
  borderWidth: "2px",
  focus: { width: "3px", offset: "2px" },
  fonts: { sans: '"Space Grotesk", "Helvetica Neue", Arial, sans-serif' },
};

export default [
  defineTheme({
    id: "neo-brutalism",
    name: "Neo-Brutalism",
    description: "Square, thick black borders, hard offset shadows, hot pink.",
    scheme: "light",
    colors: {
      canvas: "#FFF1CC",
      surface: "#FFFFFF",
      surfaceHover: "#FFE28A",
      border: "#111111",
      textPrimary: "#111111",
      textSecondary: "#2E2E2E",
      textMuted: "#595959",
      accent: "#F0437A",
      success: "#0B8A4C",
      warning: "#A85500",
      danger: "#D4111F",
      sidebarHover: "#FFE28A",
      sidebarActive: "#F0437A",
      sidebarTextActive: "#111111",
    },
    ...shape,
    shadow: {
      card: "4px 4px 0 0 #111111",
      overlay: "8px 8px 0 0 #111111",
      control: "2px 2px 0 0 #111111",
      inset: "inset 2px 2px 0 0 #111111",
    },
  }),
  defineTheme({
    id: "neo-brutalism-dark",
    name: "Neo-Brutalism Dark",
    description: "The same blocky style in the dark, with yellow shadows.",
    scheme: "dark",
    colors: {
      canvas: "#121212",
      surface: "#1C1C1C",
      surfaceHover: "#2B2B2B",
      border: "#F5F5F5",
      textPrimary: "#F5F5F5",
      textSecondary: "#CFCFCF",
      textMuted: "#9A9A9A",
      accent: "#FFD400",
      success: "#3DDC84",
      warning: "#FFA000",
      danger: "#FF5252",
      sidebarHover: "#2B2B2B",
      sidebarActive: "#FFD400",
      sidebarTextActive: "#111111",
    },
    ...shape,
    shadow: {
      card: "4px 4px 0 0 #FFD400",
      overlay: "8px 8px 0 0 #FFD400",
      control: "2px 2px 0 0 #FFD400",
      inset: "inset 2px 2px 0 0 #FFD400",
    },
  }),
];
