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
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#475569', // Modern Medium Slate Gray
          600: '#334155', // Dark Charcoal Slate
          700: '#1e293b', // Deep Charcoal
          800: '#0f172a', // Rich Black Charcoal
          900: '#020617', // Midnight Deep Gray
          accent: '#f3d372',
          cream: '#f8fafc',
          sand: '#f1f5f9',
        },
        indigo: {
          50: '#f1f5f9',  // Light Gray for active tabs/chips
          100: '#e2e8f0', // Soft Gray hover background
          200: '#cbd5e1', // Clean subtle borders
          300: '#94a3b8',
          400: '#64748b',
          500: '#334155',
          600: '#1e293b', // Primary buttons: sleek deep charcoal
          700: '#0f172a', // Primary button hover: solid black charcoal
          800: '#020617',
          900: '#000000',
        },
      },
    },
  },
  plugins: [],
};
export default config;
