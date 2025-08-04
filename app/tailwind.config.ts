import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
  darkMode: 'media',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Custom colors for new components
        main: 'hsl(var(--main, 255 255 255))', // default to white
        text: 'hsl(var(--text, 0 0 0))', // default to black
        darkText: 'hsl(var(--dark-text, 255 255 255))', // default to white for dark mode
        darkBorder: 'hsl(var(--dark-border, 255 255 255))', // default to white for dark mode
        secondaryBlack: 'hsl(var(--secondary-black, 0 0 0))', // default to black
        bg: 'hsl(var(--bg, 255 255 255))', // default to white
        darkBg: 'hsl(var(--dark-bg, 0 0 0))', // default to black
        overlay: 'hsl(var(--overlay, 0 0 0 / 0.8))', // default to black with opacity
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        base: 'var(--radius-base, 0.5rem)', // custom base radius
      },
      boxShadow: {
        light: 'var(--shadow-light, 4px 4px 0px 0px hsl(var(--border)))',
        dark: 'var(--shadow-dark, 4px 4px 0px 0px hsl(var(--dark-border, 255 255 255)))',
      },
      translate: {
        boxShadowX: 'var(--box-shadow-x, 4px)',
        boxShadowY: 'var(--box-shadow-y, 4px)',
        reverseBoxShadowX: 'var(--reverse-box-shadow-x, -4px)',
        reverseBoxShadowY: 'var(--reverse-box-shadow-y, -4px)',
      },
      fontFamily: {
        mono: ['var(--font-mono)'],
        comic: ['var(--font-comic)'],
        sans: ['var(--font-sans)'],
        heading: ['var(--font-heading, var(--font-comic))'], // fallback to comic
        base: ['var(--font-base, var(--font-sans))'], // fallback to sans
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'pulse-slow': {
          '0%, 100%': {
            backgroundColor: 'rgb(219 234 254)', // blue-100
            borderColor: 'rgb(147 197 253)', // blue-300
          },
          '50%': {
            backgroundColor: 'rgb(191 219 254)', // blue-200
            borderColor: 'rgb(96 165 250)', // blue-400
          },
        },
        'pulse-slow-dark': {
          '0%, 100%': {
            backgroundColor: 'rgb(30 58 138 / 0.2)', // blue-900/20
            borderColor: 'rgb(29 78 216)', // blue-700
          },
          '50%': {
            backgroundColor: 'rgb(30 64 175 / 0.3)', // blue-800/30
            borderColor: 'rgb(37 99 235)', // blue-600
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
        'pulse-slow-dark': 'pulse-slow-dark 3s ease-in-out infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
