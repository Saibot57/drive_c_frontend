import type { Config } from 'tailwindcss';
import tailwindAnimate from 'tailwindcss-animate';
import plugin from 'tailwindcss/plugin';

/**
 * En färg ur temats variabler (src/styles/tokens.css). Opacitetsmodifierare
 * (`bg-ui-ink/50`) fungerar inte på dem, eftersom Tailwind inte kan dela upp
 * en `var()` i kanaler. Behövs genomskinlighet får det bli en egen variabel.
 */
const uiColor = (name: string) => `var(--ui-${name})`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      width: {
        container: '1300px'
      },
      colors: {
        ui: {
          bg: uiColor('bg'),
          surface: uiColor('surface'),
          'surface-2': uiColor('surface-2'),
          'surface-3': uiColor('surface-3'),
          paper: uiColor('paper'),
          ink: uiColor('ink'),
          'ink-2': uiColor('ink-2'),
          muted: uiColor('muted'),
          subtle: uiColor('subtle'),
          line: uiColor('line'),
          hair: uiColor('hair'),
          control: uiColor('control-line'),
          accent: uiColor('accent'),
          'accent-fg': uiColor('accent-fg'),
          danger: uiColor('danger'),
          lamp: uiColor('lamp'),
        },
        main: 'var(--main)',
        mainAccent: '#88cc19',
        overlay: 'rgba(0,0,0,0.8)',
        bg: '#E0E7F1',
        text: uiColor('ink'),
        // Button och Input skriver bg-bw och text-mtext.
        bw: uiColor('paper'),
        mtext: uiColor('ink'),
        // Var `hsl(var(--border))` med `--border: #000`. Det är ogiltigt, och
        // ramen fick då textens färg (currentColor), inte svart.
        border: uiColor('line'),
        darkBg: '#2c312b',
        darkText: '#eeefe9',
        darkBorder: '#000',
        secondaryBlack: '#212121',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        }
      },
      borderWidth: {
        frame: 'var(--ui-frame-w)',
      },
      fontFamily: {
        mono: ['var(--ui-font-mono)'],
      },
      borderRadius: {
        ui: 'var(--ui-radius)',
        'ui-sm': 'var(--ui-radius-sm)',
        base: '5px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: '12px'
      },
      boxShadow: {
        frame: 'var(--ui-frame-shadow)',
        'frame-sm': 'var(--ui-frame-shadow-sm)',
        float: 'var(--ui-float-shadow)',
        shadow: 'var(--shadow)',
        light: '4px 4px 0px 0px #000',
        dark: '4px 4px 0px 0px #000',
        nav: '4px 4px 0px 0px var(--border)',
        navDark: '4px 4px 0px 0px var(--dark-border)',
        neo: '4px 4px 0px 0px rgba(0,0,0,1)'
      },
      translate: {
        // Knappen trycks in när skuggan försvinner. 0 i Kronberg, som inte
        // har någon skugga att trycka in i.
        boxShadowX: 'var(--ui-press-x)',
        boxShadowY: 'var(--ui-press-y)',
        reverseBoxShadowX: 'calc(var(--ui-press-x) * -1)',
        reverseBoxShadowY: 'calc(var(--ui-press-y) * -1)'
      },
      fontWeight: {
        base: '500',
        heading: '700'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      },
      screens: {
        w900: { raw: '(max-width: 900px)' },
        w500: { raw: '(max-width: 500px)' }
      }
    },
  },
  plugins: [
    tailwindAnimate,
    /**
     * `kron:` gäller bara i Kronberg (`kron:text-ui-muted`). Används där Neo
     * har ett värde som ingen variabel delar, så att Neo kan stå orört bredvid.
     */
    plugin(({ addVariant }) => {
      addVariant('kron', ':root[data-theme="kronberg"] &');
    }),
  ],
};

export default config;