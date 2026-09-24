import { defineTheme } from "../define";

export default defineTheme({
  id: "rose-pine-dawn",
  name: "Rosé Pine Dawn",
  description: "Peach and rose on warm cream.",
  scheme: "light",
  colors: {
    canvas: "#FAF4ED",
    surface: "#FFFAF3",
    surfaceHover: "#F2E9E1",
    border: "#DFDAD9",
    textPrimary: "#575279",
    textSecondary: "#6B6788",
    textMuted: "#8F8AA3",
    accent: "#7A6494",
    success: "#286983",
    warning: "#B57614",
    danger: "#B4637A",
  },
  radius: { control: "0.625rem", tile: "0.875rem", card: "1.125rem" },
  shadow: { card: "0 1px 3px 0 rgb(87 82 121 / 0.10)", overlay: "0 8px 24px -8px rgb(87 82 121 / 0.25)" },
});
