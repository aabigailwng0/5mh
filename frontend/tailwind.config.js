/** @type {import('tailwindcss').Config} */
// ORYZO AI "dark studio" design tokens. Warm near-black canvas, a single warm
// cream foreground, and a buried burnt-sienna hairline accent. No shadows.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "studio-black": "#100904",
        "warm-cream": "#ffedd7",
        "cork-shadow": "#40372e",
        "dark-cork": "#382416",
        "burnt-sienna": "#dc5000",
        "grey-brown": "#6c5f51",
        "forest-grid": "#445231",
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
