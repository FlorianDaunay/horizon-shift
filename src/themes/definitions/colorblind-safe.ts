import { defineTheme } from "../define";

export default defineTheme({
  id: "colorblind-safe",
  name: "Colorblind Safe",
  description: "Okabe-Ito status colors, distinguishable with common colour blindness.",
  scheme: "light",
  colors: {
    canvas: "#F7F7F7",
    surface: "#FFFFFF",
    surfaceHover: "#EDEDED",
    border: "#D2D2D2",
    textPrimary: "#111111",
    textSecondary: "#444444",
    textMuted: "#6E6E6E",
    accent: "#0072B2",
    success: "#007A5A",
    warning: "#B57700",
    danger: "#C2410C",
  },
});
