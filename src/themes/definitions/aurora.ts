import { defineTheme } from "../define";

export default defineTheme({
  id: "aurora",
  name: "Aurora",
  description: "Northern-lights gradient behind frosted glass panels.",
  scheme: "dark",
  colors: {
    canvas: "#050B18",
    surface: "#0E1A2E99",
    surfaceHover: "#1B2C4699",
    border: "#7DD3FC33",
    textPrimary: "#E8F1FF",
    textSecondary: "#B4C6E0",
    textMuted: "#8AA0C2",
    accent: "#5EEAD4",
    success: "#4ADE80",
    warning: "#FACC15",
    danger: "#FB7185",
  },
  radius: { control: "0.75rem", tile: "1rem", card: "1.25rem" },
  effects: {
    surfaceBackdrop: "blur(16px) saturate(1.3)",
    canvasImage:
      "radial-gradient(1200px 600px at 10% -10%, rgb(56 189 248 / 0.28), transparent 60%), radial-gradient(900px 500px at 90% 0%, rgb(168 85 247 / 0.28), transparent 60%), radial-gradient(900px 600px at 50% 110%, rgb(52 211 153 / 0.22), transparent 60%)",
  },
  shadow: { card: "0 4px 24px -8px rgb(0 0 0 / 0.5)", overlay: "0 12px 40px -10px rgb(0 0 0 / 0.7)" },
});
