import { defineTheme } from "../define";

export default defineTheme({
  id: "snow",
  name: "Snow",
  description: "Cool white, sky-blue accent, hairline borders.",
  scheme: "light",
  colors: {
    canvas: "#F5F8FC",
    surface: "#FFFFFF",
    surfaceHover: "#EDF2F9",
    border: "#DCE5F0",
    textPrimary: "#12233A",
    textSecondary: "#4A5C74",
    textMuted: "#7B8FA8",
    accent: "#0284C7",
    success: "#15803D",
    warning: "#C2610C",
    danger: "#DC2626",
  },
  radius: { control: "0.625rem", tile: "0.75rem", card: "1rem" },
  shadow: { card: "0 1px 2px 0 rgb(15 40 80 / 0.06)", overlay: "0 8px 28px -8px rgb(15 40 80 / 0.18)" },
});
