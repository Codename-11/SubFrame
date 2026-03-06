/** SubFrame promo video — shared design tokens matching the real app */

// Docs/site palette (used for title card, outro, branding scenes)
export const site = {
  bg: '#08080a',
  bgSecondary: '#0e0e12',
  bgElevated: '#14141a',
  bgCard: '#101014',
  textPrimary: '#eeeef0',
  textSecondary: '#9d9db0',
  textTertiary: '#6b6b80',
  accentPurple: '#a855f7',
  accentPink: '#e040a0',
  accentCyan: '#38d9f5',
} as const;

// App palette (used for UI mockup scenes — matches globals.css exactly)
export const app = {
  bgDeep: '#0f0f10',
  bgPrimary: '#151516',
  bgSecondary: '#1a1a1c',
  bgTertiary: '#222225',
  bgElevated: '#28282c',
  bgHover: '#2e2e33',
  textPrimary: '#e8e6e3',
  textSecondary: '#a09b94',
  textTertiary: '#6b6660',
  textMuted: '#4a4642',
  accent: '#d4a574',
  accentSecondary: '#c9956a',
  accentSubtle: 'rgba(212, 165, 116, 0.15)',
  accentGlow: 'rgba(212, 165, 116, 0.08)',
  success: '#7cb382',
  warning: '#e0a458',
  error: '#d47878',
  info: '#78a5d4',
  border: 'rgba(255, 255, 255, 0.06)',
  borderDefault: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
} as const;

// Legacy alias — keep existing scenes working
export const colors = {
  bg: site.bg,
  bgSecondary: site.bgSecondary,
  bgElevated: site.bgElevated,
  bgCard: site.bgCard,
  textPrimary: site.textPrimary,
  textSecondary: site.textSecondary,
  textTertiary: site.textTertiary,
  purple: '#b480ff',
  pink: '#ff6eb4',
  cyan: '#64d8ff',
  accentPurple: site.accentPurple,
  accentPink: site.accentPink,
  accentCyan: site.accentCyan,
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  border: 'rgba(255, 255, 255, 0.06)',
  borderHover: 'rgba(255, 255, 255, 0.12)',
} as const;

export const fonts = {
  display: "'DM Sans', 'Inter', -apple-system, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

/** Gradient text helper — returns a style object for gradient text */
export function gradientText(): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentPink}, ${colors.accentCyan})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  };
}

/** Glow box-shadow helper */
export function glow(color: string, size = 40, opacity = 0.3): string {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `0 0 ${size}px rgba(${r}, ${g}, ${b}, ${opacity})`;
}
