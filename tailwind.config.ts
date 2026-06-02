import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "felt-green": "#1a5c2a",
        "felt-dark": "#0f3d1a",
        "gold": "#d4af37",
        "chip-red": "#c0392b",
      },
    },
  },
  plugins: [],
};

export default config;
