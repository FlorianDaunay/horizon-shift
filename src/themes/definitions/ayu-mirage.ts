import { defineTheme } from "../define";

export default defineTheme({
  id: "ayu-mirage",
  name: "Ayu Mirage",
  description: "Slate blue-grey with a warm orange accent.",
  scheme: "dark",
  colors: {
    canvas: "#171B24",
    surface: "#1F2430",
    surfaceHover: "#2A3040",
    border: "#343B4D",
    textPrimary: "#CCCAC2",
    textSecondary: "#A6A8AE",
    textMuted: "#80889B",
    accent: "#FFA759",
    success: "#87D96C",
    warning: "#FFCC66",
    danger: "#F28779",
  },
  radius: { control: "6px", tile: "8px", card: "10px" },
});
