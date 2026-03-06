import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { colors, fonts, gradientText, glow } from '../theme';
import { AtomLogo } from '../AtomLogo';
import '../fonts';

/**
 * Scene 1: Title Card
 * Logo scales in with spring, app name fades in, tagline slides up.
 */
export const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo scale-in
  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });

  // App name fade/slide
  const nameProgress = spring({
    frame: frame - 15,
    fps,
    config: { damping: 14, stiffness: 100 },
  });
  const nameOpacity = interpolate(nameProgress, [0, 1], [0, 1]);
  const nameY = interpolate(nameProgress, [0, 1], [30, 0]);

  // Tagline fade/slide (delayed)
  const tagProgress = spring({
    frame: frame - 30,
    fps,
    config: { damping: 14, stiffness: 80 },
  });
  const tagOpacity = interpolate(tagProgress, [0, 1], [0, 1]);
  const tagY = interpolate(tagProgress, [0, 1], [20, 0]);

  // Version badge
  const badgeProgress = spring({
    frame: frame - 50,
    fps,
    config: { damping: 12, stiffness: 60 },
  });
  const badgeOpacity = interpolate(badgeProgress, [0, 1], [0, 1]);

  // Ambient glow orbs
  const orbPulse = interpolate(Math.sin(frame / 30), [-1, 1], [0.6, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Background glow orbs */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)`,
          top: '20%',
          left: '30%',
          opacity: orbPulse,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(224,64,160,0.06) 0%, transparent 70%)`,
          bottom: '20%',
          right: '25%',
          opacity: orbPulse,
        }}
      />

      {/* Logo */}
      <div style={{ transform: `scale(${logoScale})`, marginBottom: 24 }}>
        <AtomLogo size={140} />
      </div>

      {/* App Name */}
      <div
        style={{
          ...gradientText(),
          fontFamily: fonts.display,
          fontSize: 80,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          opacity: nameOpacity,
          transform: `translateY(${nameY}px)`,
        }}
      >
        SubFrame
      </div>

      {/* Tagline */}
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 28,
          color: colors.textSecondary,
          opacity: tagOpacity,
          transform: `translateY(${tagY}px)`,
          marginTop: 12,
        }}
      >
        Terminal-First IDE for AI Coding Tools
      </div>

      {/* Supporting info */}
      <div
        style={{
          marginTop: 32,
          opacity: badgeOpacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Platform line */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            fontFamily: fonts.display,
            fontSize: 20,
            color: colors.textSecondary,
          }}
        >
          <span>macOS</span>
          <span style={{ color: colors.textTertiary, fontSize: 14 }}>|</span>
          <span>Windows</span>
          <span style={{ color: colors.textTertiary, fontSize: 14 }}>|</span>
          <span>Linux</span>
        </div>

        {/* Status line */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: fonts.mono,
            fontSize: 17,
          }}
        >
          <span style={{ color: colors.accentCyan }}>Free &amp; Open Source</span>
          <span style={{ color: colors.textTertiary }}>&middot;</span>
          <span style={{ color: colors.textTertiary }}>Now in Beta</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
