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
        // Pantone 'Atmospheric' Palette (Pantone Color of the Year 2026 Collection)
        pantone: {
          cloudDancer: '#F0EEE9',   // 11-4201 TCX Cloud Dancer (Soft Lofty White)
          icedCoffee: '#B18F6A',    // 15-1040 TCX Iced Coffee (Warm Tan Beige)
          mangoMojito: '#D69C2F',   // 15-0960 TCX Mango Mojito (Golden Amber)
          cocoaCreme: '#876D58',    // 18-1020 TCX Cocoa Crème (Warm Deep Brown)
          pinkLemonade: '#EE6D8A',  // 16-1735 TCX Pink Lemonade (Vibrant Berry Coral)
          tea: '#999B85',           // 16-0213 TCX Tea (Muted Sage Olive)
          papaya: '#FEA166',        // 15-1243 TCX Papaya (Warm Apricot Orange)
          caramel: '#C57A3A',       // 16-1439 TCX Caramel (Warm Roasted Amber)
        },
        brand: {
          50: '#FAF8F5',            // Airy Cloud Canvas Tint
          100: '#F0EEE9',           // Cloud Dancer (11-4201 TCX)
          200: '#E4DDD3',           // Subtle Warm Sand Border
          300: '#D0C1B0',           // Soft Neutral Muted
          400: '#B18F6A',           // Iced Coffee (15-1040 TCX)
          500: '#C57A3A',           // Caramel (16-1439 TCX) - Primary Brand Accent
          600: '#AD662A',           // Deep Caramel (Hover/Active)
          700: '#876D58',           // Cocoa Crème (18-1020 TCX)
          800: '#5C4535',           // Dark Roasted Cocoa
          900: '#382A20',           // Deep Espresso Text
          accent: '#D69C2F',        // Mango Mojito (15-0960 TCX)
          lemonade: '#EE6D8A',      // Pink Lemonade (16-1735 TCX)
          tea: '#999B85',           // Tea (16-0213 TCX)
          papaya: '#FEA166',        // Papaya (15-1243 TCX)
          caramel: '#C57A3A',       // Caramel (16-1439 TCX)
          cloud: '#F0EEE9',         // Cloud Dancer (11-4201 TCX)
          coffee: '#B18F6A',        // Iced Coffee (15-1040 TCX)
          cocoa: '#876D58',         // Cocoa Crème (18-1020 TCX)
        },
        // Harmonize default indigo to match the warm Caramel & Cocoa Crème aesthetic
        indigo: {
          50: '#FAF8F5',
          100: '#F0EEE9',
          200: '#E4DDD3',
          300: '#D0C1B0',
          400: '#B18F6A',
          500: '#C57A3A',
          600: '#C57A3A',
          700: '#AD662A',
          800: '#876D58',
          900: '#382A20',
        },
      },
    },
  },
  plugins: [],
};
export default config;
