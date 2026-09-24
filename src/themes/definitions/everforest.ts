import { defineTheme } from "../define";

export default defineTheme({
  id: "everforest",
  name: "Everforest",
  description: "Soft forest greens, easy on the eyes.",
  scheme: "dark",
  colors: {
    canvas: "#272E33",
    surface: "#2D353B",
    surfaceHover: "#343F44",
    border: "#475258",
    textPrimary: "#D3C6AA",
    textSecondary: "#9DA9A0",
    textMuted: "#859289",
    accent: "#83C092",
    success: "#A7C080",
    warning: "#DBBC7F",
    danger: "#E67E80",
  },
  radius: { control: "0.5rem", tile: "0.75rem", card: "1rem" },
});
