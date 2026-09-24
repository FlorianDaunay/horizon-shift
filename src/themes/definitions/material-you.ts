import { defineTheme } from "../define";

export default defineTheme({
  id: "material-you",
  name: "Material You",
  description: "Tonal surfaces, no borders, very large rounded corners.",
  scheme: "light",
  colors: {
    canvas: "#FFFBFE",
    surface: "#F3EDF7",
    surfaceHover: "#E8DEF8",
    border: "#E7E0EC",
    textPrimary: "#1D1B20",
    textSecondary: "#49454F",
    textMuted: "#6F6A76",
    accent: "#6750A4",
    success: "#386A20",
    warning: "#7D5700",
    danger: "#B3261E",
    sidebarActive: "#E8DEF8",
    sidebarTextActive: "#1D192B",
  },
  radius: { control: "1.25rem", tile: "1.25rem", card: "1.75rem", pill: "9999px" },
  borderWidth: "0px",
  density: 1.06,
  shadow: { card: "none", overlay: "0 6px 16px 0 rgb(0 0 0 / 0.14)" },
});
