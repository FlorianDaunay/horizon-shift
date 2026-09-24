import { defineTheme } from "../define";

export default defineTheme({
  id: "one-dark",
  name: "One Dark",
  description: "The classic Atom editor look.",
  scheme: "dark",
  colors: {
    canvas: "#21252B",
    surface: "#282C34",
    surfaceHover: "#2C313A",
    border: "#3E4451",
    textPrimary: "#ABB2BF",
    textSecondary: "#9DA5B4",
    textMuted: "#7A8394",
    accent: "#61AFEF",
    success: "#98C379",
    warning: "#E5C07B",
    danger: "#E06C75",
  },
  radius: { control: "4px", tile: "6px", card: "8px" },
});
