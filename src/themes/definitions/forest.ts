import { defineTheme } from "../define";

export default defineTheme({
  id: "forest",
  name: "Forest",
  description: "Deep woodland greens, calm and earthy.",
  scheme: "dark",
  colors: {
    canvas: "#0B1510",
    surface: "#111F18",
    surfaceHover: "#182B21",
    border: "#23402F",
    textPrimary: "#E3F1E7",
    textSecondary: "#9DBAA6",
    textMuted: "#6F9078",
    accent: "#6FCF97",
    success: "#4ADE80",
    warning: "#E3B341",
    danger: "#F0766B",
  },
  radius: { control: "0.5rem", tile: "0.75rem", card: "1rem" },
});
