import { defineTheme } from "../define";

export default defineTheme({
  id: "nord-light",
  name: "Nord Light",
  description: "Snow Storm greys with a glacier-blue accent.",
  scheme: "light",
  colors: {
    canvas: "#E5E9F0",
    surface: "#ECEFF4",
    surfaceHover: "#D8DEE9",
    border: "#C8D0DE",
    textPrimary: "#2E3440",
    textSecondary: "#4C566A",
    textMuted: "#6F7B92",
    accent: "#44658F",
    success: "#4F7A3A",
    warning: "#9A7420",
    danger: "#BF616A",
  },
  radius: { control: "6px", tile: "8px", card: "10px" },
  shadow: { card: "0 1px 2px 0 rgb(46 52 64 / 0.08)", overlay: "0 8px 24px -8px rgb(46 52 64 / 0.22)" },
});
