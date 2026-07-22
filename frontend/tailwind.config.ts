import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        quant: {
          bg: "#F5F5F7",
          glass: "rgba(255,255,255,0.82)",
          glassHover: "rgba(0,113,227,0.09)",
          line: "rgba(0,0,0,0.08)",
          grid: "rgba(0,0,0,0.045)",
          up: "#248A3D",
          down: "#D70015",
          text: "#1D1D1F",
          muted: "#6E6E73",
          disabled: "#AEAEB2",
        },
      },
      borderRadius: {
        quant: "18px",
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Helvetica Neue"', "sans-serif"],
        mono: ['"SFMono-Regular"', '"SF Mono"', "Menlo", "monospace"],
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
