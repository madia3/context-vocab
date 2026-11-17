import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f6fa',
          100: '#e1edf5',
          200: '#c8dfeb',
          300: '#a3c8dc',
          400: '#75a9c5',
          500: '#5090b3', // Main Brand Sky-Teal
          600: '#417897', // Hover/Active
          700: '#335e76',
          800: '#254557',
          900: '#1c293d', // Deep Charcoal Navy
          accent: '#f3d372',
          cream: '#faf2e4',
          sand: '#f8ebd6',
        },
        indigo: {
          50: '#f0f6fa',
          100: '#e1edf5',
          200: '#c8dfeb',
          300: '#a3c8dc',
          400: '#75a9c5',
          500: '#5090b3',
          600: '#5090b3',
          700: '#417897',
          800: '#335e76',
          900: '#1c293d',
        },
      },
    },
  },
  plugins: [],
};
export default config;
