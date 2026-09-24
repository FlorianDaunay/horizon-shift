import { defineTheme } from "../define";

export default defineTheme({
  id: "lavender",
  name: "Lavender",
  description: "Pale violet, purple accent, soft glowing shadows.",
  scheme: "light",
  colors: {
    canvas: "#F4F0FB",
    surface: "#FBF9FF",
    surfaceHover: "#ECE5F8",
    border: "#DCD0F0",
    textPrimary: "#221A3A",
    textSecondary: "#574A78",
    textMuted: "#857AA3",
    accent: "#7C3AED",
    success: "#15803D",
    warning: "#B45309",
    danger: "#DC2626",
  },
  radius: { control: "0.75rem", tile: "1.125rem", card: "1.5rem" },
  shadow: {
    card: "0 4px 16px -6px rgb(124 58 237 / 0.18)",
    overlay: "0 12px 36px -10px rgb(124 58 237 / 0.35)",
  },
});
