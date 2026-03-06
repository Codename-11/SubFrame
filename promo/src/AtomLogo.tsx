import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { colors } from './theme';

/**
 * SubFrame atom logo — SVG version for the promo video.
 * Orbits rotate based on current frame for smooth animation.
 */
export const AtomLogo: React.FC<{ size?: number; startAt?: number }> = ({
  size = 180,
  startAt = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame - startAt) / fps;

  const orbit1 = interpolate(t, [0, 4], [0, 360], { extrapolateRight: 'extend' });
  const orbit2 = interpolate(t, [0, 5.5], [0, 360], { extrapolateRight: 'extend' });
  const orbit3 = interpolate(t, [0, 7], [0, 360], { extrapolateRight: 'extend' });
  const nucleusPulse = interpolate(Math.sin(t * 2.5), [-1, 1], [5, 6.5]);

  return (
    <svg width={size} height={size} viewBox="0 0 180 180">
      <defs>
        <filter id="ge" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feComposite in="SourceGraphic" in2="b" operator="over" />
        </filter>
        <filter id="gn" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feComposite in="SourceGraphic" in2="b" operator="over" />
        </filter>
        <radialGradient id="ag">
          <stop offset="0%" stopColor="rgba(255,110,180,0.18)" />
          <stop offset="50%" stopColor="rgba(180,128,255,0.05)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* Ambient glow */}
      <circle cx="90" cy="90" r="44" fill="url(#ag)" />

      {/* Orbit 1: Purple */}
      <g transform={`rotate(0,90,90)`}>
        <ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(180,128,255,0.3)" strokeWidth="1.5" />
        <circle
          cx={90 + 58 * Math.cos((orbit1 * Math.PI) / 180)}
          cy={90 + 22 * Math.sin((orbit1 * Math.PI) / 180)}
          r="3.5"
          fill={colors.purple}
          filter="url(#ge)"
        />
      </g>

      {/* Orbit 2: Pink (dashed) */}
      <g transform="rotate(60,90,90)">
        <ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(255,110,180,0.25)" strokeWidth="1.5" strokeDasharray="5 3.5" />
        <circle
          cx={90 + 58 * Math.cos(((orbit2 + 120) * Math.PI) / 180)}
          cy={90 + 22 * Math.sin(((orbit2 + 120) * Math.PI) / 180)}
          r="3.5"
          fill={colors.pink}
          filter="url(#ge)"
        />
      </g>

      {/* Orbit 3: Cyan */}
      <g transform="rotate(120,90,90)">
        <ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(100,216,255,0.22)" strokeWidth="1.5" />
        <circle
          cx={90 + 58 * Math.cos(((orbit3 + 240) * Math.PI) / 180)}
          cy={90 + 22 * Math.sin(((orbit3 + 240) * Math.PI) / 180)}
          r="3.5"
          fill={colors.cyan}
          filter="url(#ge)"
        />
      </g>

      {/* Nucleus */}
      <circle cx="90" cy="90" r={nucleusPulse} fill={colors.pink} filter="url(#gn)" />
    </svg>
  );
};
