import { defineTheme } from "../define";

export default defineTheme({
  id: "sunset",
  name: "Sunset",
  description: "Warm orange-to-pink gradient background, cream cards.",
  scheme: "light",
  colors: {
    canvas: "#FFF3EA",
    surface: "#FFFAF6",
    surfaceHover: "#FFE6D5",
    border: "#F6CDB4",
    textPrimary: "#3B1F2B",
    textSecondary: "#7A4A57",
    textMuted: "#9A6E7B",
    accent: "#C93E12",
    success: "#1E7D45",
    warning: "#A85F00",
    danger: "#C81E4B",
  },
  radius: { control: "0.75rem", tile: "1rem", card: "1.25rem" },
  effects: { canvasImage: "linear-gradient(135deg, #FFF3EA 0%, #FFE0D0 45%, #FFD1DC 100%)" },
  shadow: { card: "0 2px 8px -2px rgb(200 80 40 / 0.14)", overlay: "0 12px 32px -10px rgb(200 80 40 / 0.3)" },
});
