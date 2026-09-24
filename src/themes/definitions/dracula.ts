import { defineTheme } from "../define";

export default defineTheme({
  id: "dracula",
  name: "Dracula",
  description: "Purple, pink and green on charcoal.",
  scheme: "dark",
  colors: {
    canvas: "#21222C",
    surface: "#282A36",
    surfaceHover: "#343746",
    border: "#44475A",
    textPrimary: "#F8F8F2",
    textSecondary: "#C9CCE0",
    textMuted: "#8590BC",
    accent: "#BD93F9",
    success: "#50FA7B",
    warning: "#F1FA8C",
    danger: "#FF5555",
  },
  radius: { control: "6px", tile: "8px", card: "12px" },
});
