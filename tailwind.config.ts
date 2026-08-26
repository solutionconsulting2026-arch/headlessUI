import type { Config } from "tailwindcss";

/**
 * Color tokens follow the BUSINESSNEXT design system: a magenta accent on a
 * flat white/light-grey base, no gradients, no shadows/glows.
 */
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        accent: "#C2185B",
        "accent-dark": "#880E4F",
        "accent-light": "#F8BBD9",
        ink: "#212121",
        "dark-grey": "#424242",
        "mid-grey": "#757575",
        "light-grey": "#F5F5F5",
        line: "#E0E0E0",
      },
      fontFamily: {
        sans: ["Calibri", "Segoe UI", "Arial", "Helvetica Neue", "sans-serif"],
      },
      boxShadow: {
        none: "none",
      },
    },
  },
  plugins: [],
};

export default config;
