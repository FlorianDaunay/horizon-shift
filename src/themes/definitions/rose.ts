import { defineTheme } from "../define";

export default defineTheme({
  id: "rose",
  name: "Rosé",
  description: "Blush pink, rose accent, gentle corners.",
  scheme: "light",
  colors: {
    canvas: "#FCF0F2",
    surface: "#FFF9FA",
    surfaceHover: "#F9E3E7",
    border: "#F0CDD4",
    textPrimary: "#3A1820",
    textSecondary: "#7A4552",
    textMuted: "#A87783",
    accent: "#E11D48",
    success: "#15803D",
    warning: "#B45309",
    danger: "#B91C1C",
  },
  radius: { control: "0.75rem", tile: "1rem", card: "1.25rem" },
  shadow: { card: "0 2px 8px -2px rgb(190 30 70 / 0.12)", overlay: "0 10px 30px -10px rgb(190 30 70 / 0.28)" },
});
