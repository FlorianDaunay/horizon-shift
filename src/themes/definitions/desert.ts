import { defineTheme } from "../define";

export default defineTheme({
  id: "desert",
  name: "Desert",
  description: "Sun-baked sand gradient with terracotta accents.",
  scheme: "light",
  colors: {
    canvas: "#F4E6CF",
    surface: "#FBF3E4",
    surfaceHover: "#EBD9BC",
    border: "#D9C29A",
    textPrimary: "#40301A",
    textSecondary: "#6E5A3A",
    textMuted: "#8A7550",
    accent: "#C4622D",
    success: "#5E7F1F",
    warning: "#8F6100",
    danger: "#B23A2E",
  },
  radius: { control: "0.5rem", tile: "0.75rem", card: "1rem" },
  effects: { canvasImage: "linear-gradient(180deg, #F9E9CF 0%, #EFD2A8 100%)" },
  shadow: { card: "0 1px 3px 0 rgb(90 60 20 / 0.12)", overlay: "0 8px 26px -8px rgb(90 60 20 / 0.28)" },
});
