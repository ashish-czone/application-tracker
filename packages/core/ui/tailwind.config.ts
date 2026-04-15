import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['var(--font-serif)', '"Iowan Old Style"', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', '"SF Mono"', 'ui-monospace', 'Menlo', 'monospace'],
        display: ['var(--font-serif)', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
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
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          border: 'hsl(var(--sidebar-border))',
          muted: 'hsl(var(--sidebar-muted))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
        },
        'content-bg': 'hsl(var(--content-bg))',
        // "The Instrument" — compliance theme tokens
        paper: {
          DEFAULT: 'hsl(var(--paper))',
          raised: 'hsl(var(--paper-raised))',
          sunken: 'hsl(var(--paper-sunken))',
        },
        ink: {
          DEFAULT: 'hsl(var(--ink))',
          soft: 'hsl(var(--ink-soft))',
          muted: 'hsl(var(--ink-muted))',
        },
        rule: {
          DEFAULT: 'hsl(var(--rule))',
          strong: 'hsl(var(--rule-strong))',
        },
        authority: {
          DEFAULT: 'hsl(var(--authority))',
          soft: 'hsl(var(--authority-soft))',
        },
        signal: {
          DEFAULT: 'hsl(var(--signal))',
          soft: 'hsl(var(--signal-soft))',
        },
        filed: {
          DEFAULT: 'hsl(var(--filed))',
          soft: 'hsl(var(--filed-soft))',
        },
        'due-soon': {
          DEFAULT: 'hsl(var(--due-soon))',
          soft: 'hsl(var(--due-soon-soft))',
        },
      },
      letterSpacing: {
        eyebrow: '0.14em',
        tabular: '0.02em',
      },
      boxShadow: {
        'ink-hair': '0 1px 0 0 hsl(var(--rule))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
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
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
