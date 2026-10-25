const tailwindConfig = {
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Geist", "Arial", "sans-serif"],
        mono: ["var(--font-geist-mono)", "SFMono-Regular", "Consolas", "monospace"],
      },
      letterSpacing: {
        tightest: "-.06em",
        tighter: "-.04em",
        tight: "-.02em",
      },
    },
  },
};

export default tailwindConfig;
