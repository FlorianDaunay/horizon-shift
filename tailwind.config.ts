import type { Config } from "tailwindcss";
import { tailwindThemeExtension } from "./src/themes/tailwind";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // Theme colors are functions (they carry the alpha channel), which Tailwind's typings do not model.
  theme: { extend: tailwindThemeExtension() as unknown as NonNullable<Config["theme"]>["extend"] },
  plugins: [],
} satisfies Config;
