import { defineTheme } from "../define";

export default defineTheme({
  id: "github-light",
  name: "GitHub Light",
  description: "GitHub's palette: 6px corners, 1px borders, no shadows.",
  scheme: "light",
  colors: {
    canvas: "#F6F8FA",
    surface: "#FFFFFF",
    surfaceHover: "#EAEEF2",
    border: "#D0D7DE",
    textPrimary: "#1F2328",
    textSecondary: "#59636E",
    textMuted: "#7D8590",
    accent: "#0969DA",
    accentHover: "#0550AE",
    success: "#1A7F37",
    warning: "#9A6700",
    danger: "#CF222E",
  },
  radius: { control: "6px", tile: "6px", card: "6px" },
  shadow: { card: "none", overlay: "0 8px 24px 0 rgb(140 149 159 / 0.2)" },
  density: 0.96,
  fonts: { sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif' },
});
