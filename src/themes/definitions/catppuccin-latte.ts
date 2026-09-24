import { defineTheme } from "../define";

export default defineTheme({
  id: "catppuccin-latte",
  name: "Catppuccin Latte",
  description: "Soft pastels, mauve accent, rounded.",
  scheme: "light",
  colors: {
    canvas: "#E6E9EF",
    surface: "#EFF1F5",
    surfaceHover: "#DCE0E8",
    border: "#CCD0DA",
    textPrimary: "#4C4F69",
    textSecondary: "#5C5F77",
    textMuted: "#7C7F93",
    accent: "#8839EF",
    accentForeground: "#EFF1F5",
    success: "#2C7A1D",
    warning: "#96580A",
    danger: "#D20F39",
  },
  radius: { control: "0.75rem", tile: "1rem", card: "1.25rem" },
  shadow: { card: "0 1px 3px 0 rgb(76 79 105 / 0.10)", overlay: "0 8px 26px -8px rgb(76 79 105 / 0.28)" },
});
