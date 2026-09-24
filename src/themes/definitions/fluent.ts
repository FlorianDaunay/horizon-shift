import { defineTheme } from "../define";
import type { ThemeDefinition } from "../types";

const shape: Partial<ThemeDefinition> = {
  radius: { control: "4px", tile: "6px", card: "8px" },
  fonts: { sans: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif' },
};

export default [
  defineTheme({
    id: "fluent",
    name: "Fluent",
    description: "Windows 11 style: Mica greys, 8px corners, hairline borders.",
    scheme: "light",
    colors: {
      canvas: "#F3F3F3",
      surface: "#FFFFFF",
      surfaceHover: "#EFEFEF",
      border: "#E0E0E0",
      textPrimary: "#1A1A1A",
      textSecondary: "#5C5C5C",
      textMuted: "#787878",
      accent: "#0067C0",
      success: "#0F7B0F",
      warning: "#9D5D00",
      danger: "#C42B1C",
    },
    ...shape,
    shadow: {
      card: "0 2px 4px 0 rgb(0 0 0 / 0.04), 0 0 1px 0 rgb(0 0 0 / 0.12)",
      overlay: "0 8px 16px 0 rgb(0 0 0 / 0.14), 0 0 2px 0 rgb(0 0 0 / 0.12)",
    },
  }),
  defineTheme({
    id: "fluent-dark",
    name: "Fluent Dark",
    description: "Windows 11 dark: charcoal Mica, sky-blue accent.",
    scheme: "dark",
    colors: {
      canvas: "#202020",
      surface: "#2B2B2B",
      surfaceHover: "#323232",
      border: "#3D3D3D",
      textPrimary: "#FFFFFF",
      textSecondary: "#C5C5C5",
      textMuted: "#9A9A9A",
      accent: "#60CDFF",
      success: "#6CCB5F",
      warning: "#FCE100",
      danger: "#FF99A4",
    },
    ...shape,
    shadow: {
      card: "0 2px 4px 0 rgb(0 0 0 / 0.26), 0 0 1px 0 rgb(0 0 0 / 0.4)",
      overlay: "0 8px 16px 0 rgb(0 0 0 / 0.5), 0 0 2px 0 rgb(0 0 0 / 0.4)",
    },
  }),
];
