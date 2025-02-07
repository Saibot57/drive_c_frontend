import type { Config } from 'tailwindcss';
import tailwindAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      width: {
        container: '1300px'
      },
      colors: {
        main: 'var(--main)',
        mainAccent: '#88cc19',
        overlay: 'rgba(0,0,0,0.8)',
        bg: '#E0E7F1',
        text: '#000',
        border: 'hsl(var(--border))',
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
      borderRadius: {
        base: '5px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: '12px'
      },
      boxShadow: {
        shadow: 'var(--shadow)',
        light: '4px 4px 0px 0px #000',
        dark: '4px 4px 0px 0px #000',
        nav: '4px 4px 0px 0px var(--border)',
        navDark: '4px 4px 0px 0px var(--dark-border)',
        neo: '4px 4px 0px 0px rgba(0,0,0,1)'
      },
      translate: {
        boxShadowX: '2px',
        boxShadowY: '3px',
        reverseBoxShadowX: '-2px',
        reverseBoxShadowY: '-3px'
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
  plugins: [tailwindAnimate],
};

export default config;