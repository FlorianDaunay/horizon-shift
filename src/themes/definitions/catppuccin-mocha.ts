import { defineTheme } from "../define";

export default defineTheme({
  id: "catppuccin-mocha",
  name: "Catppuccin Mocha",
  description: "Cozy pastel dark with a mauve accent.",
  scheme: "dark",
  colors: {
    canvas: "#181825",
    surface: "#1E1E2E",
    surfaceHover: "#313244",
    border: "#45475A",
    textPrimary: "#CDD6F4",
    textSecondary: "#A6ADC8",
    textMuted: "#7F849C",
    accent: "#CBA6F7",
    success: "#A6E3A1",
    warning: "#F9E2AF",
    danger: "#F38BA8",
  },
  radius: { control: "0.75rem", tile: "1rem", card: "1.25rem" },
});
