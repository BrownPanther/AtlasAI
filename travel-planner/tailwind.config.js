export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 900: '#0f1729', 800: '#1a2540', 700: '#28345a' },
        accent: { DEFAULT: '#0d9488', light: '#5eead4' },
        success: '#16a34a',
        warn: '#ea580c',
        danger: '#dc2626',
      },
    },
  },
  plugins: [],
}