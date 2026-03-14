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
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      width: {
        container: '1300px'
      },
      colors: {
        main: 'var(--theme-accent-primary)',
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
        },
        // Theme Inspector tokens
        t: {
          page:         'var(--theme-page-bg)',
          'page-alt':   'var(--theme-page-bg-alt)',
          card:         'var(--theme-card-bg)',
          panel:        'var(--theme-panel-bg)',
          input:        'var(--theme-input-bg)',
          sidebar:      'var(--theme-sidebar-bg)',
          overlay:      'var(--theme-overlay-bg)',
          login:        'var(--theme-login-bg)',
          hover:        'var(--theme-hover-bg)',
          taskbar:      'var(--theme-taskbar-bg)',
          'taskbar-item': 'var(--theme-taskbar-item-bg)',
          accent:       'var(--theme-accent-primary)',
          'accent-hover': 'var(--theme-accent-primary-hover)',
          'accent-sec': 'var(--theme-accent-secondary)',
          'accent-soft': 'var(--theme-accent-soft)',
          'accent-btn': 'var(--theme-accent-button)',
          'accent-btn-hover': 'var(--theme-accent-button-hover)',
          'accent-check': 'var(--theme-accent-checkbox)',
          'text':       'var(--theme-text-primary)',
          'text-sec':   'var(--theme-text-secondary)',
          'text-muted': 'var(--theme-text-muted)',
          'text-on-accent': 'var(--theme-text-on-accent)',
          border:       'var(--theme-border-color)',
          'border-sub': 'var(--theme-border-subtle)',
          shadow:       'var(--theme-shadow-color)',
          ring:         'var(--theme-ring-color)',
          'cc-notes':   'var(--theme-cc-notes-bg)',
          'cc-notes-s': 'var(--theme-cc-notes-stripe)',
          'cc-cal':     'var(--theme-cc-calendar-bg)',
          'cc-cal-s':   'var(--theme-cc-calendar-stripe)',
          'cc-todo':    'var(--theme-cc-todo-bg)',
          'cc-todo-s':  'var(--theme-cc-todo-stripe)',
          'cc-sched':   'var(--theme-cc-schedule-bg)',
          'cc-sched-s': 'var(--theme-cc-schedule-stripe)',
          tag:          'var(--theme-tag-bg)',
          'tag-border': 'var(--theme-tag-border)',
          'focus-ring': 'var(--theme-focus-ring)',
          divider:      'var(--theme-divider)',
          'plan-card':  'var(--theme-planner-card-bg)',
          'plan-btn':   'var(--theme-planner-btn-bg)',
          'plan-chip':  'var(--theme-planner-chip-bg)',
          'plan-shadow': 'var(--theme-planner-btn-shadow)',
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
        neo: '4px 4px 0px 0px var(--theme-shadow-color)',
        'neo-sm': '2px 2px 0px 0px var(--theme-shadow-color)',
        'neo-md': '3px 3px 0px 0px var(--theme-shadow-color)',
        'neo-lg': '6px 6px 0px 0px var(--theme-shadow-color)',
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