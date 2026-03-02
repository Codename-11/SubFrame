/**
 * SubFrame Logo — Centralized SVG definitions
 *
 * Neon synthwave atom: 3 elliptical orbits at 60 intervals,
 * varied speeds (4s/5.5s/7s), dashed middle ring, pulsing nucleus,
 * animated frame outline that draws in on load.
 *
 * Colors: Purple #b480ff, Pink #ff6eb4, Cyan #64d8ff
 * Orbits: 1.5px stroke, rx=58 ry=22
 */

export interface LogoOptions {
  /** Rendered width/height in px (default: 180) */
  size?: number;
  /** Unique ID prefix to avoid SVG filter collisions (default: 'logo') */
  id?: string;
  /** Include the animated frame outline (default: true) */
  frame?: boolean;
  /** Include animations (default: true) */
  animate?: boolean;
  /** If true, no animations at all (for static icons) */
  staticSnap?: boolean;
}

/**
 * Generate the animated atom logo SVG at any size.
 */
export function getLogoSVG(options: LogoOptions = {}): string {
  const {
    size = 180,
    id = 'logo',
    frame = true,
    animate = true,
    staticSnap = false,
  } = options;

  const anim = animate && !staticSnap;

  const ambientAnims = anim ? `
      <animate attributeName="r" values="36;48;36" dur="3s" repeatCount="indefinite" calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"/>
      <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"/>` : '';

  const electronMotion = (pathId: string, dur: number, begin: number): string => anim
    ? `<animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite"><mpath href="#${pathId}"/></animateMotion>`
    : '';

  const nucleusPulse = anim ? `
      <animate attributeName="r" values="5;6.5;5" dur="2.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"/>` : '';

  const frameEl = frame ? `
    <rect x="10" y="10" width="160" height="160" rx="14" ry="14"
      fill="none" stroke="url(#${id}-fg)" stroke-width="1.5"
      ${anim ? 'stroke-dasharray="632" stroke-dashoffset="632"' : ''}
      filter="url(#${id}-gf)" ${anim ? 'opacity="0"' : 'opacity="1"'}>
      ${anim ? `<animate attributeName="opacity" values="0;1" dur="0.3s" begin="0.5s" fill="freeze"/>
      <animate attributeName="stroke-dashoffset" from="632" to="0" dur="2s" begin="0.5s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1"/>` : ''}
    </rect>` : '';

  return `<svg width="${size}" height="${size}" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="${id}-ge" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="5" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
    <filter id="${id}-gn" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="10" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
    <filter id="${id}-gf" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
    <radialGradient id="${id}-ag"><stop offset="0%" stop-color="rgba(255,110,180,0.18)"/><stop offset="50%" stop-color="rgba(180,128,255,0.05)"/><stop offset="100%" stop-color="transparent"/></radialGradient>
    <linearGradient id="${id}-fg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#b480ff" stop-opacity="0.5"/><stop offset="50%" stop-color="#ff6eb4" stop-opacity="0.4"/><stop offset="100%" stop-color="#64d8ff" stop-opacity="0.5"/></linearGradient>
  </defs>
  <circle cx="90" cy="90" r="40" fill="url(#${id}-ag)">${ambientAnims}</circle>
  <g transform="rotate(0,90,90)">
    <ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(180,128,255,0.3)" stroke-width="1.5"/>
    <path id="${id}-p1" d="M32,90A58,22 0 1,0 148,90A58,22 0 1,0 32,90" fill="none"/>
    <circle r="3" fill="#b480ff" filter="url(#${id}-ge)">${electronMotion(`${id}-p1`, 4, 0)}</circle>
  </g>
  <g transform="rotate(60,90,90)">
    <ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(255,110,180,0.25)" stroke-width="1.5" stroke-dasharray="5 3.5"/>
    <path id="${id}-p2" d="M32,90A58,22 0 1,0 148,90A58,22 0 1,0 32,90" fill="none"/>
    <circle r="3" fill="#ff6eb4" filter="url(#${id}-ge)">${electronMotion(`${id}-p2`, 5.5, -1.833)}</circle>
  </g>
  <g transform="rotate(120,90,90)">
    <ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(100,216,255,0.22)" stroke-width="1.5"/>
    <path id="${id}-p3" d="M32,90A58,22 0 1,0 148,90A58,22 0 1,0 32,90" fill="none"/>
    <circle r="3" fill="#64d8ff" filter="url(#${id}-ge)">${electronMotion(`${id}-p3`, 7, -4.667)}</circle>
  </g>
  <circle cx="90" cy="90" r="5.5" fill="#ff6eb4" filter="url(#${id}-gn)">${nucleusPulse}</circle>
  ${frameEl}
</svg>`;
}

/** Logo color palette */
export const LOGO_COLORS = {
  purple: '#b480ff',
  pink: '#ff6eb4',
  cyan: '#64d8ff',
  gradientCSS: 'linear-gradient(90deg, #b480ff, #ff6eb4)',
} as const;
