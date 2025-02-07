import type { Config } from 'tailwindcss'; // Correct import for Config type
import tailwindAnimate from 'tailwindcss-animate';

const config: Config = { // Correct type annotation for config
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
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        }
      },
      borderRadius: {
        base: '5px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      boxShadow: {
        shadow: 'var(--shadow)',
        light: '4px 4px 0px 0px #000',
        dark: '4px 4px 0px 0px #000',
        nav: '4px 4px 0px 0px var(--border)',
        navDark: '4px 4px 0px 0px var(--dark-border)'
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
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        },
        marquee: {
          '0%': {
            transform: 'translateX(0%)'
          },
          '100%': {
            transform: 'translateX(-100%)'
          }
        },
        marquee2: {
          '0%': {
            transform: 'translateX(100%)'
          },
          '100%': {
            transform: 'translateX(0%)'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        marquee: 'marquee 15s linear infinite',
        marquee2: 'marquee2 15s linear infinite'
      },
      screens: {
        w900: {
          raw: '(max-width: 900px)'
        },
        w500: {
          raw: '(max-width: 500px)'
        }
      }
    },
  },
  plugins: [tailwindAnimate], // Corrected plugins array - just tailwindAnimate
};

export default config;