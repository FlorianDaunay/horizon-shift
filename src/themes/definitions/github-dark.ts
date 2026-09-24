import { defineTheme } from "../define";

export default defineTheme({
  id: "github-dark",
  name: "GitHub Dark",
  description: "GitHub's dark palette: 6px corners, no shadows.",
  scheme: "dark",
  colors: {
    canvas: "#0D1117",
    surface: "#161B22",
    surfaceHover: "#21262D",
    border: "#30363D",
    textPrimary: "#E6EDF3",
    textSecondary: "#9DA7B3",
    textMuted: "#7D8590",
    accent: "#58A6FF",
    success: "#3FB950",
    warning: "#D29922",
    danger: "#F85149",
  },
  radius: { control: "6px", tile: "6px", card: "6px" },
  shadow: { card: "none", overlay: "0 8px 24px 0 rgb(1 4 9 / 0.75)" },
  density: 0.96,
  fonts: { sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif' },
});
