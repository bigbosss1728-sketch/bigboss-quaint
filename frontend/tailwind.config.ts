import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        quant: {
          bg: "#F2D398",
          glass: "rgba(242,211,152,0.58)",
          glassHover: "rgba(60,107,110,0.14)",
          line: "rgba(60,107,110,0.28)",
          grid: "rgba(60,107,110,0.16)",
          up: "#3C6B6E",
          down: "#C0553A",
          text: "#3C6B6E",
          muted: "rgba(60,107,110,0.76)",
          disabled: "rgba(60,107,110,0.46)",
        },
      },
      borderRadius: {
        quant: "8px",
      },
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', "Consolas", "monospace"],
      },
      transitionDuration: {
        quant: "280ms",
      },
      transitionTimingFunction: {
        quant: "ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
