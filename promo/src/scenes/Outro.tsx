import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { colors, fonts, gradientText, glow } from '../theme';
import { AtomLogo } from '../AtomLogo';

/**
 * Scene 5: Outro
 * CTA with app name, repo URL, and call to action.
 */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo
  const logoProgress = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });
  const logoScale = interpolate(logoProgress, [0, 1], [0.5, 1]);
  const logoOpacity = interpolate(logoProgress, [0, 1], [0, 1]);

  // Title
  const titleProgress = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 100 } });
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [20, 0]);

  // CTA button
  const ctaProgress = spring({ frame: frame - 30, fps, config: { damping: 12, stiffness: 80 } });
  const ctaOpacity = interpolate(ctaProgress, [0, 1], [0, 1]);
  const ctaScale = interpolate(ctaProgress, [0, 1], [0.9, 1]);

  // URL
  const urlProgress = spring({ frame: frame - 45, fps, config: { damping: 14, stiffness: 80 } });
  const urlOpacity = interpolate(urlProgress, [0, 1], [0, 1]);

  // Tagline
  const tagProgress = spring({ frame: frame - 55, fps, config: { damping: 14, stiffness: 80 } });
  const tagOpacity = interpolate(tagProgress, [0, 1], [0, 1]);

  // Pulsing glow behind CTA
  const glowPulse = interpolate(Math.sin(frame / 20), [-1, 1], [0.5, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Background ambient glow */}
      <div
        style={{
          position: 'absolute',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(168,85,247,0.1) 0%, rgba(224,64,160,0.05) 40%, transparent 70%)`,
          opacity: glowPulse,
        }}
      />

      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          marginBottom: 28,
        }}
      >
        <AtomLogo size={130} />
      </div>

      {/* Title */}
      <div
        style={{
          ...gradientText(),
          fontFamily: fonts.display,
          fontSize: 80,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          marginBottom: 24,
        }}
      >
        SubFrame
      </div>

      {/* CTA */}
      <div
        style={{
          opacity: ctaOpacity,
          transform: `scale(${ctaScale})`,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 28,
            fontWeight: 600,
            color: colors.textPrimary,
            padding: '18px 52px',
            borderRadius: 12,
            background: `linear-gradient(135deg, rgba(168,85,247,0.2), rgba(224,64,160,0.15))`,
            border: `1px solid rgba(168,85,247,0.4)`,
            boxShadow: glow(colors.accentPurple, 40, 0.2 * glowPulse),
          }}
        >
          Try the Beta
        </div>
      </div>

      {/* Repo URL */}
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 20,
          color: colors.accentCyan,
          opacity: urlOpacity,
          marginBottom: 24,
        }}
      >
        github.com/Codename-11/SubFrame
      </div>

      {/* Site URL + Tagline */}
      <div
        style={{
          opacity: tagOpacity,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 20,
            color: colors.textSecondary,
            marginBottom: 10,
          }}
        >
          sub-frame.dev
        </div>
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 24,
            color: colors.textSecondary,
          }}
        >
          Enhance your AI tools. Don&apos;t replace them.
        </div>
      </div>
    </AbsoluteFill>
  );
};
