import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";
import plugin from "tailwindcss/plugin";

type ColorTree = { [key: string]: string | ColorTree };

/**
 * Modo escuro sem `dark:` em cada componente: as cores claras mais usadas
 * (fundos brancos/cinza, textos escuros, bordas e os tons pastel de alerta)
 * leem variáveis CSS. Em :root elas valem exatamente o padrão do Tailwind;
 * em html.dark trocam pela versão escura. Tons já escuros (slate-950,
 * botões -500/-600) não mudam.
 */
const themeVars: Record<string, [light: string, dark: string]> = {};

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function themed(name: string, light: string, dark: string): string {
  themeVars[`--c-${name}`] = [hexToRgb(light), hexToRgb(dark)];
  return `rgb(var(--c-${name}) / <alpha-value>)`;
}

const slate = colors.slate;

const backgroundColor: ColorTree = {
  white: themed("bg-white", "#FFFFFF", slate[900]),
  slate: {
    50: themed("bg-slate-50", slate[50], "#0B1120"),
    100: themed("bg-slate-100", slate[100], slate[800]),
    200: themed("bg-slate-200", slate[200], slate[700]),
    300: themed("bg-slate-300", slate[300], slate[600]),
    800: themed("bg-slate-800", slate[800], slate[600]),
    900: themed("bg-slate-900", slate[900], slate[700]),
  },
  domu: {
    blue: {
      light: themed("bg-domu-blue-light", "#EFF4FF", colors.blue[950]),
      subtle: themed("bg-domu-blue-subtle", "#DBEAFE", colors.blue[900]),
    },
    slate: {
      bg: themed("bg-domu-slate-bg", "#F8FAFC", "#0B1120"),
      surface: themed("bg-domu-slate-surface", "#F1F5F9", slate[800]),
      card: themed("bg-domu-slate-card", "#FFFFFF", slate[900]),
    },
    green: {
      light: themed("bg-domu-green-light", "#ECFDF5", colors.emerald[950]),
    },
  },
};

const textColor: ColorTree = {
  slate: {
    500: themed("text-slate-500", slate[500], slate[400]),
    600: themed("text-slate-600", slate[600], "#B4C0D0"),
    700: themed("text-slate-700", slate[700], slate[300]),
    800: themed("text-slate-800", slate[800], slate[200]),
    900: themed("text-slate-900", slate[900], slate[100]),
  },
  domu: {
    blue: {
      DEFAULT: themed("text-domu-blue", "#1E5AF6", "#6B9BFF"),
    },
  },
};

const borderColor: ColorTree = {
  DEFAULT: themed("border-default", colors.gray[200], "#273348"),
  slate: {
    100: themed("border-slate-100", slate[100], slate[800]),
    200: themed("border-slate-200", slate[200], "#273348"),
    300: themed("border-slate-300", slate[300], slate[700]),
  },
  domu: {
    slate: {
      border: themed("border-domu-slate-border", "#E2E8F0", "#273348"),
    },
  },
};

const TINTED_HUES = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan",
  "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
] as const;

for (const hue of TINTED_HUES) {
  const c = colors[hue] as Record<string, string>;
  backgroundColor[hue] = {
    50: themed(`bg-${hue}-50`, c[50], c[950]),
    100: themed(`bg-${hue}-100`, c[100], c[900]),
    200: themed(`bg-${hue}-200`, c[200], c[800]),
  };
  textColor[hue] = {
    600: themed(`text-${hue}-600`, c[600], c[400]),
    700: themed(`text-${hue}-700`, c[700], c[300]),
    800: themed(`text-${hue}-800`, c[800], c[200]),
    900: themed(`text-${hue}-900`, c[900], c[100]),
  };
  borderColor[hue] = {
    100: themed(`border-${hue}-100`, c[100], c[900]),
    200: themed(`border-${hue}-200`, c[200], c[800]),
    300: themed(`border-${hue}-300`, c[300], c[700]),
  };
}

const lightVars = Object.fromEntries(Object.entries(themeVars).map(([k, [l]]) => [k, l]));
const darkVars = Object.fromEntries(Object.entries(themeVars).map(([k, [, d]]) => [k, d]));

const config: Config = {
  darkMode: "class",
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
      backgroundColor,
      textColor,
      borderColor,
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
  plugins: [
    plugin(({ addBase }) => {
      addBase({ ":root": lightVars, "html.dark": darkVars });
    }),
  ],
};
export default config;
