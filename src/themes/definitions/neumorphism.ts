import { defineTheme } from "../define";

const dark = "#B8BEC9";
const light = "#FFFFFF";

export default defineTheme({
  id: "neumorphism",
  name: "Neumorphism",
  description: "Same-colour surfaces raised and pressed with soft twin shadows.",
  scheme: "light",
  colors: {
    canvas: "#E0E5EC",
    surface: "#E0E5EC",
    surfaceHover: "#D5DAE2",
    border: "#CBD1DB",
    textPrimary: "#3D4457",
    textSecondary: "#586076",
    textMuted: "#747C91",
    accent: "#5B52F0",
    success: "#1B7A4D",
    warning: "#966008",
    danger: "#B33A36",
    sidebarActive: "#D3D8E0",
  },
  radius: { control: "0.75rem", tile: "1.25rem", card: "1.5rem" },
  borderWidth: "0px",
  density: 1.04,
  shadow: {
    card: `8px 8px 16px ${dark}, -8px -8px 16px ${light}`,
    overlay: `12px 12px 24px #B0B6C2, -12px -12px 24px ${light}`,
    control: `4px 4px 8px ${dark}, -4px -4px 8px ${light}`,
    inset: `inset 3px 3px 6px ${dark}, inset -3px -3px 6px ${light}`,
  },
});
