import { defineTheme } from "../define";

export default defineTheme({
  id: "blueprint",
  name: "Blueprint",
  description: "Technical-drawing blue, dashed white rules, monospace.",
  scheme: "dark",
  colors: {
    canvas: "#0C3B66",
    surface: "#0F4A7F",
    surfaceHover: "#145A99",
    border: "#8CC0F0",
    textPrimary: "#EAF4FF",
    textSecondary: "#B5D5F5",
    textMuted: "#8FB8DE",
    accent: "#9BE7FF",
    success: "#7CFFB2",
    warning: "#FFE082",
    danger: "#FF9E9E",
  },
  radius: { control: "0px", tile: "0px", card: "0px", pill: "0px" },
  shadow: { card: "none", overlay: "0 0 0 1px #8CC0F0" },
  borderStyle: "dashed",
  density: 0.96,
  fonts: { sans: '"JetBrains Mono", "Cascadia Mono", Consolas, Menlo, monospace' },
});
