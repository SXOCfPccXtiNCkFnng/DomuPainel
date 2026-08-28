import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        domu: {
          blue: {
            DEFAULT: "#1E5AF6",
            hover: "#0052FF",
            light: "#EFF4FF",
            subtle: "#DBEAFE",
            dark: "#1746C7"
          },
          navy: {
            DEFAULT: "#0B132B",
            card: "#0F172A",
            light: "#1E293B",
            border: "#334155"
          },
          slate: {
            bg: "#F8FAFC",
            surface: "#F1F5F9",
            card: "#FFFFFF",
            border: "#E2E8F0"
          },
          green: {
            DEFAULT: "#10B981",
            whatsapp: "#25D366",
            light: "#ECFDF5"
          }
        }
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px'
      },
      boxShadow: {
        'domu': '0 10px 30px -10px rgba(30, 90, 246, 0.08)',
        'domu-hover': '0 15px 35px -5px rgba(30, 90, 246, 0.15)',
        'domu-navy': '0 12px 30px -10px rgba(11, 19, 43, 0.3)'
      }
    },
  },
  plugins: [],
};
export default config;
