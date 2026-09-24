import { defineTheme } from "../define";

export default defineTheme({
  id: "solarized-light",
  name: "Solarized Light",
  description: "Ethan Schoonover's palette, flat and square-ish.",
  scheme: "light",
  colors: {
    canvas: "#F5EEDA",
    surface: "#FDF6E3",
    surfaceHover: "#EEE8D5",
    border: "#D9D2BD",
    textPrimary: "#073642",
    textSecondary: "#586E75",
    textMuted: "#728486",
    accent: "#1B6FA8",
    success: "#6E7D00",
    warning: "#9A7400",
    danger: "#DC322F",
  },
  radius: { control: "4px", tile: "4px", card: "6px", pill: "9999px" },
  shadow: { card: "none", overlay: "0 6px 20px -6px rgb(7 54 66 / 0.25)" },
});
