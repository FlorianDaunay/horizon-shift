import { defineTheme } from "../define";

export default defineTheme({
  id: "gruvbox-light",
  name: "Gruvbox Light",
  description: "Cream, orange and brown with a retro feel.",
  scheme: "light",
  colors: {
    canvas: "#F2E5BC",
    surface: "#FBF1C7",
    surfaceHover: "#EBDBB2",
    border: "#D5C4A1",
    textPrimary: "#3C3836",
    textSecondary: "#665C54",
    textMuted: "#7C6F64",
    accent: "#AF3A03",
    accentForeground: "#FBF1C7",
    success: "#79740E",
    warning: "#9A5F0A",
    danger: "#9D0006",
  },
  radius: { control: "3px", tile: "4px", card: "6px", pill: "9999px" },
  shadow: { card: "none", overlay: "0 6px 18px -6px rgb(60 56 54 / 0.3)" },
});
