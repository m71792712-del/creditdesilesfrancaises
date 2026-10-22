import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50: '#eef3fb', 100: '#d6e2f5', 200: '#aec5eb', 600: '#14468f', 700: '#0f3a78', 800: '#0b2d5e', 900: '#081f44', 950: '#051630' },
        lagoon: { 50: '#e8fbf6', 100: '#c5f5e8', 400: '#2fc7a0', 500: '#12ad86', 600: '#0b8f6d', 700: '#0a7358' },
        ocean: { 500: '#1d7fd1', 600: '#1668b0' },
      },
      boxShadow: { soft: '0 6px 28px -8px rgba(8, 31, 68, 0.18)' },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        script: ['"Segoe Script"', '"Brush Script MT"', '"Snell Roundhand"', 'cursive'],
      },
    },
  },
  plugins: [],
};

export default config;
