import { defineTheme } from "../define";

const raised = "inset -1px -1px 0 #0A0A0A, inset 1px 1px 0 #FFFFFF, inset -2px -2px 0 #808080, inset 2px 2px 0 #DFDFDF";
const sunken = "inset -1px -1px 0 #FFFFFF, inset 1px 1px 0 #0A0A0A, inset -2px -2px 0 #DFDFDF, inset 2px 2px 0 #808080";

export default defineTheme({
  id: "retro-95",
  name: "Retro 95",
  description: "Grey bevelled controls, square, Tahoma-style type.",
  scheme: "light",
  colors: {
    canvas: "#C0C0C0",
    surface: "#C0C0C0",
    surfaceHover: "#D4D4D4",
    border: "#808080",
    textPrimary: "#000000",
    textSecondary: "#1F1F1F",
    textMuted: "#565656",
    accent: "#000080",
    success: "#006400",
    warning: "#7A5A00",
    danger: "#B00000",
    sidebarActive: "#000080",
    sidebarTextActive: "#FFFFFF",
  },
  radius: { control: "0px", tile: "0px", card: "0px", pill: "0px" },
  density: 0.94,
  focus: { width: "1px", offset: "2px" },
  shadow: {
    card: "inset 1px 1px 0 #FFFFFF, inset -1px -1px 0 #808080",
    overlay: `${raised}, 3px 3px 0 0 rgb(0 0 0 / 0.35)`,
    control: raised,
    inset: sunken,
  },
  fonts: { sans: '"MS Sans Serif", Tahoma, Verdana, "Segoe UI", sans-serif' },
});
