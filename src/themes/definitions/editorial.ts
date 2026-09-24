import { defineTheme } from "../define";
import type { ThemeDefinition } from "../types";

const shape: Partial<ThemeDefinition> = {
  radius: { control: "0px", tile: "0px", card: "0px", pill: "0px" },
  shadow: { card: "none", overlay: "0 12px 32px -14px rgb(0 0 0 / 0.35)" },
  density: 1.04,
  fonts: { sans: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif' },
};

export default [
  defineTheme({
    id: "editorial",
    name: "Editorial",
    description: "Magazine look: serif type, hairline rules, no shadows or corners.",
    scheme: "light",
    colors: {
      canvas: "#FAF8F5",
      surface: "#FAF8F5",
      surfaceHover: "#F0EDE6",
      border: "#2A2A2A",
      textPrimary: "#1A1A1A",
      textSecondary: "#4A4A4A",
      textMuted: "#767676",
      accent: "#1F4E8C",
      success: "#2E6B3A",
      warning: "#8A5A00",
      danger: "#B3261E",
    },
    ...shape,
  }),
  defineTheme({
    id: "editorial-dark",
    name: "Editorial Dark",
    description: "The magazine look after dark: light rules on near-black.",
    scheme: "dark",
    colors: {
      canvas: "#141414",
      surface: "#141414",
      surfaceHover: "#1F1F1F",
      border: "#A8A49A",
      textPrimary: "#EDE9E0",
      textSecondary: "#B8B4AA",
      textMuted: "#8A867D",
      accent: "#8FB4EA",
      success: "#7FBF8A",
      warning: "#E0B04A",
      danger: "#E57373",
    },
    ...shape,
  }),
];
