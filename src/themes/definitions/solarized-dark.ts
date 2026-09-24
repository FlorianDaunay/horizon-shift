import { defineTheme } from "../define";

export default defineTheme({
  id: "solarized-dark",
  name: "Solarized Dark",
  description: "Teal-tinted dark, flat and square-ish.",
  scheme: "dark",
  colors: {
    canvas: "#00212B",
    surface: "#002B36",
    surfaceHover: "#073642",
    border: "#124A59",
    textPrimary: "#EEE8D5",
    textSecondary: "#93A1A1",
    textMuted: "#6C8489",
    accent: "#2AA198",
    success: "#9AB300",
    warning: "#D19A00",
    danger: "#F04A47",
  },
  radius: { control: "4px", tile: "4px", card: "6px", pill: "9999px" },
  shadow: { card: "none", overlay: "0 6px 20px -6px rgb(0 0 0 / 0.55)" },
});
