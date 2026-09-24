import { defineTheme } from "../define";

export default defineTheme({
  id: "cyberpunk-neon",
  name: "Cyberpunk Neon",
  description: "Black with magenta and cyan neon, small corners, glowing halos.",
  scheme: "dark",
  colors: {
    canvas: "#07040F",
    surface: "#0F0A1E",
    surfaceHover: "#1A1233",
    border: "#00E5FF44",
    textPrimary: "#E8F9FF",
    textSecondary: "#9FD7E6",
    textMuted: "#6FA0BB",
    accent: "#FF2BD6",
    success: "#00FFA3",
    warning: "#FFE600",
    danger: "#FF3860",
  },
  radius: { control: "2px", tile: "4px", card: "6px", pill: "4px" },
  focus: { width: "2px", offset: "3px" },
  shadow: {
    card: "0 0 0 1px rgb(255 43 214 / 0.25), 0 0 24px -4px rgb(255 43 214 / 0.35)",
    overlay: "0 0 0 1px rgb(0 229 255 / 0.4), 0 0 40px -6px rgb(0 229 255 / 0.5)",
    control: "0 0 12px -2px rgb(255 43 214 / 0.55)",
    inset: "inset 0 0 10px rgb(0 229 255 / 0.25)",
  },
});
