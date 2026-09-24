import { defineTheme } from "../define";

export default defineTheme({
  id: "graphite",
  name: "Graphite",
  description: "Neutral grey, no tint, teal accent, sharp corners.",
  scheme: "dark",
  colors: {
    canvas: "#16181A",
    surface: "#1E2124",
    surfaceHover: "#272B2F",
    border: "#33383D",
    textPrimary: "#E4E7EA",
    textSecondary: "#A3AAB1",
    textMuted: "#78808A",
    accent: "#2DD4BF",
    success: "#4ADE80",
    warning: "#FBBF24",
    danger: "#F87171",
  },
  radius: { control: "4px", tile: "6px", card: "8px", pill: "6px" },
  shadow: { card: "none", overlay: "0 8px 24px -8px rgb(0 0 0 / 0.6)" },
});
