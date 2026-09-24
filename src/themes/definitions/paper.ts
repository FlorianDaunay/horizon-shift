import { defineTheme } from "../define";

export default defineTheme({
  id: "paper",
  name: "Paper",
  description: "Warm off-white, ink text, serif type, fine corners.",
  scheme: "light",
  colors: {
    canvas: "#F6F1E7",
    surface: "#FBF8F1",
    surfaceHover: "#EFE8D9",
    border: "#DDD3BF",
    textPrimary: "#2B2620",
    textSecondary: "#5C5346",
    textMuted: "#8C8171",
    accent: "#B4532A",
    success: "#3F7D4B",
    warning: "#A06510",
    danger: "#B3392F",
  },
  radius: { control: "4px", tile: "6px", card: "8px", pill: "6px" },
  shadow: { card: "none", overlay: "0 8px 24px -8px rgb(60 40 20 / 0.18)" },
  fonts: { sans: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif' },
});
