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
        // Editorial-collage palette: clean off-white paper, near-black ink, one purple accent.
        ink: "#161412",
        paper: "#f6f6f4",
        "paper-2": "#eeeeec",
        "paper-card": "#ffffff",
      },
      fontFamily: {
        // Pairing C — Newsreader body, Fraunces display, Space Mono labels.
        sans: ['"Newsreader"', "ui-serif", "Georgia", "serif"],
        serif: ['"Newsreader"', "ui-serif", "Georgia", "serif"],
        display: ['"Fraunces"', "ui-serif", "Georgia", "serif"],
        mono: ['"Space Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
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
        // Analog/print: crisp corners. The torn-paper effect supplies the
        // organic edge instead of soft rounding.
        card: "2px",
        pill: "2px",
        rounded: "2px",
      },
    },
  },
  plugins: [],
};
