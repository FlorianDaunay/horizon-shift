import { defineTheme } from "../define";

export default defineTheme({
  id: "night-owl",
  name: "Night Owl",
  description: "Deep blue, made for late-night work.",
  scheme: "dark",
  colors: {
    canvas: "#010E1A",
    surface: "#011627",
    surfaceHover: "#0B2942",
    border: "#16405F",
    textPrimary: "#D6DEEB",
    textSecondary: "#A6B6CC",
    textMuted: "#6C8AA6",
    accent: "#82AAFF",
    success: "#ADDB67",
    warning: "#ECC48D",
    danger: "#EF5350",
  },
  radius: { control: "6px", tile: "8px", card: "10px" },
});
