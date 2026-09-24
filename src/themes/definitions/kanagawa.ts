import { defineTheme } from "../define";

export default defineTheme({
  id: "kanagawa",
  name: "Kanagawa",
  description: "Inspired by Hokusai's wave: ink and rice paper.",
  scheme: "dark",
  colors: {
    canvas: "#16161D",
    surface: "#1F1F28",
    surfaceHover: "#2A2A37",
    border: "#363646",
    textPrimary: "#DCD7BA",
    textSecondary: "#C8C093",
    textMuted: "#8A8980",
    accent: "#7E9CD8",
    success: "#98BB6C",
    warning: "#E6C384",
    danger: "#E46876",
  },
  radius: { control: "6px", tile: "8px", card: "10px" },
});
