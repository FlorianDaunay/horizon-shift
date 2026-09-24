import { defineTheme } from "../define";

export default defineTheme({
  id: "midnight",
  name: "Midnight",
  description: "Deep navy, near-black, electric blue accent.",
  scheme: "dark",
  colors: {
    canvas: "#070B16",
    surface: "#0E1424",
    surfaceHover: "#151D33",
    border: "#1E2945",
    textPrimary: "#E6EBF7",
    textSecondary: "#9AA6C4",
    textMuted: "#66739A",
    accent: "#4C8DFF",
    success: "#34D399",
    warning: "#FBBF24",
    danger: "#F87171",
  },
  shadow: { card: "0 1px 2px 0 rgb(0 0 0 / 0.4)", overlay: "0 8px 32px -8px rgb(0 0 0 / 0.6)" },
});
