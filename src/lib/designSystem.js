/**
 * FamOS Unified Design System
 * Single source of truth for spacing, radius, elevation, and component patterns.
 * Import tokens from here instead of hardcoding values.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SPACING SCALE (8px base)
// ─────────────────────────────────────────────────────────────────────────────
export const spacing = {
  none: '0',
  xs: '2px',      // 0.25rem
  sm: '4px',      // 0.5rem
  md: '8px',      // 1rem - BASE UNIT
  lg: '12px',     // 1.5rem
  xl: '16px',     // 2rem
  '2xl': '24px',  // 3rem
  '3xl': '32px',  // 4rem
  '4xl': '48px',  // 6rem
  '5xl': '64px',  // 8rem
};

// Tailwind-compatible spacing classes
export const space = {
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
};

// ─────────────────────────────────────────────────────────────────────────────
// BORDER RADIUS SCALE
// ─────────────────────────────────────────────────────────────────────────────
export const radius = {
  none: '0',
  xs: '4px',      // --radius-xs
  sm: '6px',      // --radius-sm
  md: '8px',      // --radius-md
  lg: '12px',     // --radius-lg
  xl: '16px',     // --radius-xl
  '2xl': '24px',  // --radius-2xl
  full: '9999px', // --radius-pill
};

// Tailwind-compatible radius classes
export const rounded = {
  none: 'rounded-none',
  xs: 'rounded-xs',     // 4px
  sm: 'rounded-sm',     // 6px
  md: 'rounded-md',     // 8px
  lg: 'rounded-lg',     // 12px
  xl: 'rounded-xl',     // 16px
  '2xl': 'rounded-2xl', // 24px
  full: 'rounded-full', // 9999px
};

// ─────────────────────────────────────────────────────────────────────────────
// ELEVATION / SHADOWS (3 levels max)
// ─────────────────────────────────────────────────────────────────────────────
export const elevation = {
  xs: '0 1px 2px rgba(17, 24, 39, 0.04)',                    // --shadow-xs
  sm: '0 2px 4px rgba(17, 24, 39, 0.05)',                   // --shadow-sm
  md: '0 4px 12px rgba(17, 24, 39, 0.06)',                  // --shadow-md
  lg: '0 8px 24px rgba(17, 24, 39, 0.08)',                  // --shadow-lg
  xl: '0 12px 32px rgba(17, 24, 39, 0.10)',                 // --shadow-floating
  inner: 'inset 0 1px 1px rgba(255, 255, 255, 0.15)',       // inner highlight
};

// Tailwind-compatible shadow classes
export const shadow = {
  xs: 'shadow-xs',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  inner: 'shadow-inner',
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSITIONS / MOTION
// ─────────────────────────────────────────────────────────────────────────────
export const motion = {
  fast: '140ms',
  normal: '200ms',
  base: '280ms',
  slow: '400ms',
  easeOut: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
};

// Tailwind-compatible transition classes
export const transition = {
  fast: 'transition-all duration-150 ease-out',
  normal: 'transition-all duration-200 ease-out',
  base: 'transition-all duration-300 ease-out',
  slow: 'transition-all duration-400 ease-out',
};

// ─────────────────────────────────────────────────────────────────────────────
// Z-INDEX LAYERS (systematic)
// ─────────────────────────────────────────────────────────────────────────────
export const zIndex = {
  base: 0,
  dropdown: 30,
  sticky: 40,
  overlay: 50,
  modal: 60,
  toast: 70,
  tooltip: 80,
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT PRESETS (consistent patterns)
// ─────────────────────────────────────────────────────────────────────────────

// Card variants
export const card = {
  base: 'bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs',
  elevated: 'bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm',
  floating: 'bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg',
  sunken: 'bg-[var(--color-surface-sunken)] border border-[var(--color-border)]',
  interactive: 'bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs hover:border-[var(--color-border-strong)] hover:shadow-sm active:shadow-xs active:scale-[0.995] transition-all duration-150 ease-out',
  rounded: {
    sm: 'rounded-lg',   // 12px
    md: 'rounded-xl',   // 16px
    lg: 'rounded-2xl',  // 24px
  },
};

// Button variants
export const button = {
  base: 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
  sizes: {
    xs: 'px-2.5 py-1.5 text-xs min-h-[28px]',
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-5 py-2.5 text-base min-h-[44px]',
    lg: 'px-6 py-3 text-lg min-h-[52px]',
  },
  primary: 'bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] active:scale-[0.98] shadow-xs',
  secondary: 'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border)] hover:bg-[var(--color-surface-raised)] hover:border-[var(--color-border-strong)]',
  ghost: 'bg-transparent text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]',
  danger: 'bg-[var(--color-warn)] text-[var(--color-on-accent)] hover:bg-[var(--color-warn-hover)] active:scale-[0.98]',
  pill: 'rounded-full',
  rounded: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
  },
};

// Input variants
export const input = {
  base: 'w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] transition-all duration-150 ease-out focus-visible:outline-none focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/20',
  sizes: {
    sm: 'px-3 py-2 text-sm min-h-[36px] rounded-lg',
    md: 'px-4 py-2.5 text-base min-h-[44px] rounded-xl',
    lg: 'px-4 py-3 text-lg min-h-[52px] rounded-xl',
  },
};

// Badge variants
export const badge = {
  base: 'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full',
  variants: {
    neutral: 'bg-[var(--color-surface-sunken)] text-[var(--color-ink-soft)]',
    accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]',
    good: 'bg-[var(--color-good-soft)] text-[var(--color-good)]',
    warn: 'bg-[var(--color-warn-soft)] text-[var(--color-warn)]',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const layout = {
  page: 'px-5 space-y-6',                    // Standard page content
  pageTight: 'px-5 space-y-4',               // Tighter page content
  section: 'space-y-6',                      // Section spacing
  cardGrid: 'grid gap-4',                    // Card grid
  cardGridSm: 'grid gap-3',                  // Tight card grid
  cardGridLg: 'grid gap-6',                  // Loose card grid
  stack: 'flex flex-col gap-3',              // Vertical stack
  stackLg: 'flex flex-col gap-6',            // Loose vertical stack
  inline: 'flex items-center gap-2',         // Inline elements
  inlineLg: 'flex items-center gap-4',       // Loose inline
  divider: 'border-t border-[var(--color-border)] my-4',
};

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSIVE BREAKPOINTS (Tailwind)
// ─────────────────────────────────────────────────────────────────────────────

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// ─────────────────────────────────────────────────────────────────────────────
// COLOR SEMANTIC HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  // Backgrounds
  canvas: 'bg-[var(--color-canvas)]',
  surface: 'bg-[var(--color-surface)]',
  surfaceRaised: 'bg-[var(--color-surface-raised)]',
  surfaceSunken: 'bg-[var(--color-surface-sunken)]',
  
  // Text
  ink: 'text-[var(--color-ink)]',
  inkSoft: 'text-[var(--color-ink-soft)]',
  inkMuted: 'text-[var(--color-ink-muted)]',
  inkFaint: 'text-[var(--color-ink-faint)]',
  onAccent: 'text-[var(--color-on-accent)]',
  
  // Borders
  border: 'border-[var(--color-border)]',
  borderStrong: 'border-[var(--color-border-strong)]',
  borderFocus: 'border-[var(--color-border-focus)]',
  
  // Accent
  accent: 'bg-[var(--color-accent)] text-[var(--color-on-accent)]',
  accentSoft: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]',
  accentHover: 'hover:bg-[var(--color-accent-hover)]',
  
  // Status
  good: 'bg-[var(--color-good-soft)] text-[var(--color-good)]',
  goodBorder: 'border-[var(--color-good)]',
  warn: 'bg-[var(--color-warn-soft)] text-[var(--color-warn)]',
  warnBorder: 'border-[var(--color-warn)]',
  
  // Category
  calendar: 'bg-[var(--color-calendar-soft)] text-[var(--color-calendar)]',
  calendarBorder: 'border-[var(--color-calendar)]',
  meals: 'bg-[var(--color-meals-soft)] text-[var(--color-meals)]',
  mealsBorder: 'border-[var(--color-meals)]',
  tasks: 'bg-[var(--color-tasks-soft)] text-[var(--color-tasks)]',
  tasksBorder: 'border-[var(--color-tasks)]',
  shopping: 'bg-[var(--color-shopping-soft)] text-[var(--color-shopping)]',
  shoppingBorder: 'border-[var(--color-shopping)]',
  chat: 'bg-[var(--color-chat-soft)] text-[var(--color-chat)]',
  chatBorder: 'border-[var(--color-chat)]',
  finance: 'bg-[var(--color-finance-soft)] text-[var(--color-finance)]',
  financeBorder: 'border-[var(--color-finance)]',
  family: 'bg-[var(--color-family-soft)] text-[var(--color-family)]',
  familyBorder: 'border-[var(--color-family)]',
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────────────────────────────────────

export const typography = {
  // Headings
  display: 'font-[var(--font-display)] text-[var(--text-display)] font-semibold tracking-tight',
  displayLg: 'font-[var(--font-display)] text-[var(--text-display-lg)] font-semibold tracking-tight',
  h1: 'font-[var(--font-display)] text-[var(--text-page)] font-semibold tracking-tight',
  h2: 'font-[var(--font-display)] text-[var(--text-section)] font-semibold tracking-tight',
  h3: 'font-[var(--font-display)] text-[var(--text-body-lg)] font-medium',
  
  // Body
  body: 'font-[var(--font-sans)] text-[var(--text-body)] leading-relaxed',
  bodyLg: 'font-[var(--font-sans)] text-[var(--text-body-lg)] leading-relaxed',
  bodySm: 'font-[var(--font-sans)] text-[var(--text-sm)] leading-normal',
  caption: 'font-[var(--font-sans)] text-[var(--text-xs)] leading-normal',
  
  // Weights
  light: 'font-light',
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
  
  // Special
  mono: 'font-mono text-sm',
  uppercase: 'uppercase tracking-wider text-xs font-semibold',
};

export default {
  spacing,
  space,
  radius,
  rounded,
  elevation,
  shadow,
  motion,
  transition,
  zIndex,
  card,
  button,
  input,
  badge,
  layout,
  breakpoints,
  colors,
  typography,
};
