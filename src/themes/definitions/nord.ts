import { defineTheme } from "../define";

export default defineTheme({
  id: "nord",
  name: "Nord",
  description: "Arctic blue-greys with an ice-cyan accent.",
  scheme: "dark",
  colors: {
    canvas: "#242933",
    surface: "#2E3440",
    surfaceHover: "#3B4252",
    border: "#434C5E",
    textPrimary: "#ECEFF4",
    textSecondary: "#B8C1D1",
    textMuted: "#8590A6",
    accent: "#88C0D0",
    success: "#A3BE8C",
    warning: "#EBCB8B",
    danger: "#E27A84",
  },
  radius: { control: "6px", tile: "8px", card: "10px" },
  shadow: { card: "0 1px 2px 0 rgb(0 0 0 / 0.25)", overlay: "0 8px 28px -8px rgb(0 0 0 / 0.5)" },
});
