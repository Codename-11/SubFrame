/**
 * SubFrame Logo — Neon synthwave atom
 *
 * 3 elliptical orbits at 60° intervals with electrons,
 * pulsing nucleus, animated frame outline.
 * Colors: Purple #b480ff, Pink #ff6eb4, Cyan #64d8ff
 *
 * Ported from src/shared/logoSVG.ts
 */

interface LogoProps {
  size?: number
  id?: string
  frame?: boolean
  animate?: boolean
  className?: string
}

export function Logo({
  size = 180,
  id = "logo",
  frame = true,
  animate = true,
  className,
}: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 180 180"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <filter id={`${id}-ge`} x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feComposite in="SourceGraphic" in2="b" operator="over" />
        </filter>
        <filter id={`${id}-gn`} x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feComposite in="SourceGraphic" in2="b" operator="over" />
        </filter>
        <filter id={`${id}-gf`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feComposite in="SourceGraphic" in2="b" operator="over" />
        </filter>
        <radialGradient id={`${id}-ag`}>
          <stop offset="0%" stopColor="rgba(255,110,180,0.18)" />
          <stop offset="50%" stopColor="rgba(180,128,255,0.05)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id={`${id}-fg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b480ff" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#ff6eb4" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#64d8ff" stopOpacity="0.5" />
        </linearGradient>
      </defs>

      {/* Ambient glow */}
      <circle cx="90" cy="90" r="40" fill={`url(#${id}-ag)`}>
        {animate && (
          <>
            <animate attributeName="r" values="36;48;36" dur="3s" repeatCount="indefinite" calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
            <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
          </>
        )}
      </circle>

      {/* Orbit 1 — Purple */}
      <g transform="rotate(0,90,90)">
        <ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(180,128,255,0.3)" strokeWidth="1.5" />
        <path id={`${id}-p1`} d="M32,90A58,22 0 1,0 148,90A58,22 0 1,0 32,90" fill="none" />
        <circle r="3" fill="#b480ff" filter={`url(#${id}-ge)`}>
          {animate && (
            <animateMotion dur="4s" begin="0s" repeatCount="indefinite">
              <mpath href={`#${id}-p1`} />
            </animateMotion>
          )}
        </circle>
      </g>

      {/* Orbit 2 — Pink (dashed) */}
      <g transform="rotate(60,90,90)">
        <ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(255,110,180,0.25)" strokeWidth="1.5" strokeDasharray="5 3.5" />
        <path id={`${id}-p2`} d="M32,90A58,22 0 1,0 148,90A58,22 0 1,0 32,90" fill="none" />
        <circle r="3" fill="#ff6eb4" filter={`url(#${id}-ge)`}>
          {animate && (
            <animateMotion dur="5.5s" begin="-1.833s" repeatCount="indefinite">
              <mpath href={`#${id}-p2`} />
            </animateMotion>
          )}
        </circle>
      </g>

      {/* Orbit 3 — Cyan */}
      <g transform="rotate(120,90,90)">
        <ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(100,216,255,0.22)" strokeWidth="1.5" />
        <path id={`${id}-p3`} d="M32,90A58,22 0 1,0 148,90A58,22 0 1,0 32,90" fill="none" />
        <circle r="3" fill="#64d8ff" filter={`url(#${id}-ge)`}>
          {animate && (
            <animateMotion dur="7s" begin="-4.667s" repeatCount="indefinite">
              <mpath href={`#${id}-p3`} />
            </animateMotion>
          )}
        </circle>
      </g>

      {/* Nucleus */}
      <circle cx="90" cy="90" r="5.5" fill="#ff6eb4" filter={`url(#${id}-gn)`}>
        {animate && (
          <animate attributeName="r" values="5;6.5;5" dur="2.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
        )}
      </circle>

      {/* Frame outline */}
      {frame && (
        <rect
          x="10" y="10" width="160" height="160" rx="14" ry="14"
          fill="none" stroke={`url(#${id}-fg)`} strokeWidth="1.5"
          filter={`url(#${id}-gf)`}
          {...(animate ? {
            strokeDasharray: "632",
            strokeDashoffset: "632",
            opacity: "0",
          } : { opacity: "1" })}
        >
          {animate && (
            <>
              <animate attributeName="opacity" values="0;1" dur="0.3s" begin="0.5s" fill="freeze" />
              <animate attributeName="stroke-dashoffset" from="632" to="0" dur="2s" begin="0.5s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
            </>
          )}
        </rect>
      )}
    </svg>
  )
}
