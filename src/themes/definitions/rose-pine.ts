import { defineTheme } from "../define";

export default defineTheme({
  id: "rose-pine",
  name: "Rosé Pine",
  description: "Muted rose and gold on deep purple.",
  scheme: "dark",
  colors: {
    canvas: "#191724",
    surface: "#1F1D2E",
    surfaceHover: "#26233A",
    border: "#403D52",
    textPrimary: "#E0DEF4",
    textSecondary: "#908CAA",
    textMuted: "#6E6A86",
    accent: "#EBBCBA",
    success: "#9CCFD8",
    warning: "#F6C177",
    danger: "#EB6F92",
  },
  radius: { control: "0.625rem", tile: "0.875rem", card: "1.125rem" },
});
