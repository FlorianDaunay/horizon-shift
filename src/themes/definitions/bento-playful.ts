import { defineTheme } from "../define";

export default defineTheme({
  id: "bento-playful",
  name: "Bento Playful",
  description: "Huge corners, chunky soft shadows, pastel warmth.",
  scheme: "light",
  colors: {
    canvas: "#FFF6E9",
    surface: "#FFFFFF",
    surfaceHover: "#FFEBD1",
    border: "#F6DDC0",
    textPrimary: "#2B2140",
    textSecondary: "#5B4E7A",
    textMuted: "#7F729E",
    accent: "#7C4DFF",
    success: "#12805A",
    warning: "#B26A00",
    danger: "#E5384F",
  },
  radius: { control: "1rem", tile: "1.5rem", card: "2rem", pill: "9999px" },
  borderWidth: "2px",
  density: 1.08,
  shadow: {
    card: "0 6px 0 0 rgb(43 33 64 / 0.06), 0 14px 28px -10px rgb(124 77 255 / 0.28)",
    overlay: "0 10px 0 0 rgb(43 33 64 / 0.06), 0 24px 48px -12px rgb(124 77 255 / 0.4)",
    control: "0 3px 0 0 rgb(43 33 64 / 0.18)",
    inset: "inset 0 2px 0 0 rgb(43 33 64 / 0.12)",
  },
});
