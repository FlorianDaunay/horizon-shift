import { defineTheme } from "../define";

export default defineTheme({
  id: "amber-crt",
  name: "Amber CRT",
  description: "Monochrome amber phosphor, square, all monospace.",
  scheme: "dark",
  colors: {
    canvas: "#0A0500",
    surface: "#120A02",
    surfaceHover: "#1F1305",
    border: "#6B4409",
    textPrimary: "#FFB000",
    textSecondary: "#D18F00",
    textMuted: "#A67400",
    accent: "#FFCC33",
    success: "#9BD400",
    warning: "#FFB000",
    danger: "#FF5A36",
  },
  radius: { control: "0px", tile: "0px", card: "0px", pill: "0px" },
  shadow: { card: "none", overlay: "0 0 0 1px #6B4409" },
  density: 0.92,
  focus: { width: "1px", offset: "2px" },
  fonts: { sans: '"JetBrains Mono", "Cascadia Mono", "Cascadia Code", Consolas, Menlo, monospace' },
});
