import { defineTheme } from "../define";

export default defineTheme({
  id: "terminal",
  name: "Terminal",
  description: "Phosphor green on black, square, everything monospace.",
  scheme: "dark",
  colors: {
    canvas: "#000000",
    surface: "#040A04",
    surfaceHover: "#0A1A0A",
    border: "#14602A",
    textPrimary: "#5CFF85",
    textSecondary: "#2FBF57",
    textMuted: "#1F9A45",
    accent: "#00FF41",
    success: "#5CFF85",
    warning: "#E6E600",
    danger: "#FF4D4D",
  },
  radius: { control: "0px", tile: "0px", card: "0px", pill: "0px" },
  shadow: { card: "none", overlay: "0 0 0 1px #14602A" },
  density: 0.92,
  focus: { width: "1px", offset: "2px" },
  fonts: { sans: '"JetBrains Mono", "Cascadia Mono", "Cascadia Code", Consolas, Menlo, monospace' },
});
