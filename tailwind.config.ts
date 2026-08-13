import type { Config } from "tailwindcss";

/**
 * ӨНГӨНИЙ СИСТЕМ — GEid логоны албан ёсны палитр
 *
 *   flame  #FD5901  Тод улбар шар
 *   orange #F78104  Улбар шар          — өргөлт, дулаан өнгө
 *   gold   #FAAB36  Алтан шар          — тодруулга, анхааруулга
 *   aqua   #249EA0  Цэнхэр-ногоон      — амжилт, хоёрдогч
 *   teal   #008083  Гүн turquoise      — ҮНДСЭН (товч, цэс)
 *   deep   #005F60  Хар ногоовтор teal — гүн суурь, толгой
 *
 * Логоны 6 өнгө нь 500-р байрлалд, эргэн тойрны сүүдрийг тэдгээрээс
 * гаргав. ink нь teal туяатай нейтрал.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Гүн turquoise — үндсэн
        teal: {
          50: "#eefafa",
          100: "#d0f2f2",
          200: "#a4e5e6",
          300: "#6bd0d2",
          400: "#2fb3b6",
          500: "#008083",
          600: "#007073",
          700: "#005f60",
          800: "#014d4e",
          900: "#043f40",
        },
        // Цэнхэр-ногоон — хоёрдогч, амжилт
        aqua: {
          50: "#f0fbfb",
          100: "#d6f4f4",
          200: "#ade8e9",
          300: "#79d5d7",
          400: "#45babd",
          500: "#249ea0",
          600: "#188082",
          700: "#166769",
          800: "#175456",
          900: "#164748",
        },
        // Алтан шар — тодруулга, анхааруулга
        gold: {
          50: "#fff9ed",
          100: "#fff1d4",
          200: "#ffe0a8",
          300: "#fdc971",
          400: "#faab36",
          500: "#f79312",
          600: "#e2740b",
          700: "#bb560d",
          800: "#954412",
          900: "#7a3912",
        },
        // Улбар шар — өргөлт
        orange: {
          50: "#fff5ed",
          100: "#ffe8d4",
          200: "#ffcda8",
          300: "#ffaa70",
          400: "#fd7f37",
          500: "#f78104",
          600: "#e05f02",
          700: "#b94506",
          800: "#93380c",
          900: "#78300d",
        },
        // Тод улбар шар — хамгийн эрч хүчтэй өргөлт
        flame: {
          50: "#fff4ed",
          100: "#ffe5d4",
          200: "#ffc7a8",
          300: "#ff9f70",
          400: "#ff6f36",
          500: "#fd5901",
          600: "#e83f00",
          700: "#c02c04",
          800: "#98250c",
          900: "#7c220e",
        },
        // Нейтрал — teal туяатай
        ink: {
          50: "#f3f8f8",
          100: "#e2eeee",
          200: "#c6dbdb",
          300: "#9dbfc0",
          400: "#6f9b9c",
          500: "#487374", // жижиг шошго/хүснэгтийн толгойд AA хангахаар гүнзгийрүүлэв
          600: "#3e6768",
          700: "#345555",
          800: "#2d4747",
          900: "#182c2c",
          950: "#0f2020",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgb(1 77 78 / 0.09), 0 8px 24px -8px rgb(1 77 78 / 0.11)",
        lift: "0 4px 16px -4px rgb(1 77 78 / 0.13), 0 16px 40px -12px rgb(1 77 78 / 0.17)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
        drift: {
          "0%": { transform: "translate3d(0,0,0) rotate(0deg)" },
          "33%": { transform: "translate3d(14px,-20px,0) rotate(7deg)" },
          "66%": { transform: "translate3d(-12px,-10px,0) rotate(-6deg)" },
          "100%": { transform: "translate3d(0,0,0) rotate(0deg)" },
        },
        "pulse-soft": {
          "0%,100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.06)" },
        },
      },
      animation: {
        "fade-up": "fade-up .5s ease-out both",
        float: "float 9s ease-in-out infinite",
        drift: "drift 22s ease-in-out infinite",
        "pulse-soft": "pulse-soft 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
