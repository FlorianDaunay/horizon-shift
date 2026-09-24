import { defineTheme } from "../define";

export default defineTheme({
  id: "gruvbox-dark",
  name: "Gruvbox Dark",
  description: "Warm retro browns with an orange accent.",
  scheme: "dark",
  colors: {
    canvas: "#1D2021",
    surface: "#282828",
    surfaceHover: "#3C3836",
    border: "#504945",
    textPrimary: "#EBDBB2",
    textSecondary: "#D5C4A1",
    textMuted: "#A89984",
    accent: "#FE8019",
    success: "#B8BB26",
    warning: "#FABD2F",
    danger: "#FB4934",
  },
  radius: { control: "3px", tile: "4px", card: "6px", pill: "9999px" },
  shadow: { card: "none", overlay: "0 6px 20px -6px rgb(0 0 0 / 0.6)" },
});
