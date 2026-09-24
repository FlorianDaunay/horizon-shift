import { defineTheme } from "../define";

export default defineTheme({
  id: "monokai",
  name: "Monokai",
  description: "Olive-black with neon pink and yellow.",
  scheme: "dark",
  colors: {
    canvas: "#1E1F1C",
    surface: "#272822",
    surfaceHover: "#33342D",
    border: "#49483E",
    textPrimary: "#F8F8F2",
    textSecondary: "#CFCFC2",
    textMuted: "#928F79",
    accent: "#F92672",
    success: "#A6E22E",
    warning: "#E6DB74",
    danger: "#FF6B5E",
  },
  radius: { control: "4px", tile: "6px", card: "8px" },
});
