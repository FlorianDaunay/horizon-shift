import { defineTheme } from "../define";

export default defineTheme({
  id: "sand",
  name: "Sand",
  description: "Beige and brown, copper accent, soft corners.",
  scheme: "light",
  colors: {
    canvas: "#F3EBDD",
    surface: "#FAF5EA",
    surfaceHover: "#EDE2CF",
    border: "#DACBB0",
    textPrimary: "#3A2E1F",
    textSecondary: "#6B5B45",
    textMuted: "#8F7F66",
    accent: "#B45F06",
    success: "#4D7C3A",
    warning: "#A66A0A",
    danger: "#B3382C",
  },
  radius: { control: "0.625rem", tile: "0.875rem", card: "1.125rem" },
  shadow: { card: "0 1px 3px 0 rgb(90 60 20 / 0.10)", overlay: "0 8px 24px -8px rgb(90 60 20 / 0.22)" },
});
