import { defineTheme } from "../define";

export default defineTheme({
  id: "sepia",
  name: "Sepia",
  description: "Reading mode: yellowed paper, low glare.",
  scheme: "light",
  colors: {
    canvas: "#F1E7D0",
    surface: "#F8F0DE",
    surfaceHover: "#EADFC4",
    border: "#D8C9A6",
    textPrimary: "#433422",
    textSecondary: "#6E5B3F",
    textMuted: "#8E7C5D",
    accent: "#8B5E34",
    accentForeground: "#FBF3E0",
    success: "#4F6B2E",
    warning: "#8F5D0A",
    danger: "#A63D2F",
  },
  radius: { control: "6px", tile: "8px", card: "10px" },
  shadow: { card: "none", overlay: "0 6px 20px -6px rgb(67 52 34 / 0.25)" },
  fonts: { sans: '"Iowan Old Style", Georgia, "Times New Roman", serif' },
});
