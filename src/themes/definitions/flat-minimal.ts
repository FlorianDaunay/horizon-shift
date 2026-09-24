import { defineTheme } from "../define";

export default defineTheme({
  id: "flat-minimal",
  name: "Flat Minimal",
  description: "No borders, no shadows: only tonal surfaces.",
  scheme: "light",
  colors: {
    canvas: "#F2F3F5",
    surface: "#FFFFFF",
    surfaceHover: "#E9EBEE",
    border: "#E9EBEE",
    textPrimary: "#1B1F24",
    textSecondary: "#555D68",
    textMuted: "#77808D",
    accent: "#3B82F6",
    success: "#15803D",
    warning: "#B45309",
    danger: "#DC2626",
  },
  radius: { control: "0.5rem", tile: "0.75rem", card: "1rem" },
  borderWidth: "0px",
  shadow: { card: "none", overlay: "0 8px 24px -8px rgb(0 0 0 / 0.18)" },
});
