import { defineTheme } from "../define";

export default defineTheme({
  id: "ocean",
  name: "Ocean",
  description: "Deep sea blues with a teal-cyan accent.",
  scheme: "dark",
  colors: {
    canvas: "#04141F",
    surface: "#082333",
    surfaceHover: "#0D3148",
    border: "#14415F",
    textPrimary: "#E2F4FB",
    textSecondary: "#93BBCF",
    textMuted: "#6A93A9",
    accent: "#22B8CF",
    success: "#34D399",
    warning: "#FBBF24",
    danger: "#FB7185",
  },
  radius: { control: "0.625rem", tile: "0.875rem", card: "1.25rem" },
  shadow: { card: "0 1px 3px 0 rgb(0 20 40 / 0.5)", overlay: "0 10px 30px -10px rgb(0 20 40 / 0.7)" },
});
