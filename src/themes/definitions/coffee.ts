import { defineTheme } from "../define";

export default defineTheme({
  id: "coffee",
  name: "Coffee",
  description: "Dark roast browns with a caramel accent.",
  scheme: "dark",
  colors: {
    canvas: "#17100B",
    surface: "#21170F",
    surfaceHover: "#2D2016",
    border: "#3F2E1F",
    textPrimary: "#EDDFCB",
    textSecondary: "#BBA485",
    textMuted: "#8E7B62",
    accent: "#C8935A",
    success: "#8DB36A",
    warning: "#E0B04A",
    danger: "#D9695B",
  },
  radius: { control: "0.625rem", tile: "0.875rem", card: "1.125rem" },
});
