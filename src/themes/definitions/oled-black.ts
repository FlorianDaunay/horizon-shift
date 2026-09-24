import { defineTheme } from "../define";

export default defineTheme({
  id: "oled-black",
  name: "OLED Black",
  description: "True black, hairline borders, no shadows, vivid accent.",
  scheme: "dark",
  colors: {
    canvas: "#000000",
    surface: "#0A0A0A",
    surfaceHover: "#151515",
    border: "#222222",
    textPrimary: "#F2F2F2",
    textSecondary: "#A6A6A6",
    textMuted: "#737373",
    accent: "#8B6BFF",
    success: "#22E58A",
    warning: "#FFC933",
    danger: "#FF5C5C",
  },
  shadow: { card: "none", overlay: "0 0 0 1px #222222" },
});
