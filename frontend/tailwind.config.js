/** @type {import('tailwindcss').Config} */
// ORYZO AI "dark studio" design tokens. Warm near-black canvas, a single warm
// cream foreground, and a buried burnt-sienna hairline accent. No shadows.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "studio-black": "#f5f1ed",
        "warm-cream": "#000000",
        "cork-shadow": "#ccb5f8",
        "dark-cork": "#ccb5f8",
        "burnt-sienna": "#ccb5f8",
        "grey-brown": "#000000",
        "forest-grid": "#ccb5f8",
      },
      fontFamily: {
        // halyard-display-variable substitute (per the design spec).
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        caption: ["10px", { lineHeight: "1.2" }],
        body: ["14px", { lineHeight: "1.33" }],
        subheading: ["18px", { lineHeight: "1.2" }],
        "heading-sm": ["24px", { lineHeight: "1.1" }],
        heading: ["29px", { lineHeight: "1.09" }],
        "heading-lg": ["41px", { lineHeight: "1" }],
        display: ["51px", { lineHeight: "0.9" }],
      },
      borderRadius: {
        card: "12px",
        pill: "36px",
        rounded: "22.5px",
      },
    },
  },
  plugins: [],
};
