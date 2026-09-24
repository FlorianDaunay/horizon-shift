import { defineTheme } from "../define";
import type { ThemeDefinition } from "../types";

const shape: Partial<ThemeDefinition> = {
  radius: { control: "0.5rem", tile: "0.75rem", card: "1rem" },
};

export default [
  defineTheme({
    id: "docker-whale",
    name: "Docker Whale",
    description: "Docker blue on light, with a deep navy sidebar.",
    scheme: "light",
    colors: {
      canvas: "#F4F8FB",
      surface: "#FFFFFF",
      surfaceHover: "#EAF2F8",
      border: "#D6E3EE",
      textPrimary: "#0B1F33",
      textSecondary: "#445A70",
      textMuted: "#6F8499",
      accent: "#1D63ED",
      success: "#1C9C5B",
      warning: "#B26A00",
      danger: "#D92D20",
      sidebar: "#0F2A47",
      sidebarBorder: "#0F2A47",
      sidebarText: "#B7C9DD",
      sidebarTextStrong: "#FFFFFF",
      sidebarTextActive: "#FFFFFF",
      sidebarHover: "#173A5E",
      sidebarActive: "#1D63ED",
    },
    ...shape,
  }),
  defineTheme({
    id: "docker-whale-dark",
    name: "Docker Whale Dark",
    description: "Docker blue on deep navy.",
    scheme: "dark",
    colors: {
      canvas: "#0A1929",
      surface: "#10243B",
      surfaceHover: "#16314F",
      border: "#1F3E60",
      textPrimary: "#E7F0FA",
      textSecondary: "#9DB5CF",
      textMuted: "#7891AD",
      accent: "#2496ED",
      success: "#2FCB80",
      warning: "#F5B031",
      danger: "#F26D6D",
      sidebar: "#071320",
      sidebarBorder: "#122943",
      sidebarText: "#9DB5CF",
      sidebarTextStrong: "#FFFFFF",
      sidebarTextActive: "#FFFFFF",
      sidebarHover: "#122943",
      sidebarActive: "#2496ED33",
    },
    ...shape,
  }),
];
