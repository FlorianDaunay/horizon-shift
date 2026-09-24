import { defineTheme } from "../define";

export default defineTheme({
  id: "mint",
  name: "Mint",
  description: "Pale mint background, green accent, big rounded corners.",
  scheme: "light",
  colors: {
    canvas: "#EAF7F1",
    surface: "#F7FCF9",
    surfaceHover: "#DDF1E7",
    border: "#C6E5D6",
    textPrimary: "#0F2A20",
    textSecondary: "#3D5F4F",
    textMuted: "#6C8C7D",
    accent: "#059669",
    success: "#15803D",
    warning: "#B45309",
    danger: "#DC2626",
  },
  radius: { control: "0.75rem", tile: "1.125rem", card: "1.5rem" },
  shadow: { card: "0 2px 6px -1px rgb(5 100 70 / 0.10)", overlay: "0 10px 30px -10px rgb(5 100 70 / 0.25)" },
});
