import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { colors, fonts, glow, gradientText } from '../theme';

/**
 * Scene 2: Problem Statement (8 seconds = 240 frames @ 30fps)
 *
 * Visual chaos → clean resolution.
 * Stacked terminal windows pile up as pain points type in,
 * then collapse into nothing as "There's a better way." appears.
 *
 * Timeline:
 *   0-15:    First terminal fades in
 *   15-140:  Pain points type one by one, extra terminal windows stack behind
 *   150-170: Chaos windows shake subtly, then fade/scale out
 *   170-210: "There's a better way." springs in with gradient glow
 *   210-240: Hold
 */

const problems = [
  { text: 'Five terminal windows open. None of them are the right one.' },
  { text: 'Want to try Codex or Gemini? Start over in a new setup.' },
  { text: 'Every context switch costs you 15 minutes of flow.' },
  { text: "You're gluing together tools that should just work together." },
];

// Background chaos terminals — tilted, overlapping windows
const chaosWindows = [
  { x: -320, y: -80, rot: -4, w: 520, title: 'bash — npm run dev', delay: 30 },
  { x: 280, y: -60, rot: 3, w: 480, title: 'node — server.js', delay: 55 },
  { x: -200, y: 100, rot: 2, w: 440, title: 'zsh — ~/projects', delay: 80 },
  { x: 340, y: 120, rot: -3, w: 500, title: 'Terminal 4', delay: 105 },
];

const MiniTerminal: React.FC<{
  x: number;
  y: number;
  rot: number;
  w: number;
  title: string;
  progress: number;
  chaosProgress: number;
}> = ({ x, y, rot, w, title, progress, chaosProgress }) => {
  const opacity = interpolate(progress, [0, 1], [0, 0.35])
    * interpolate(chaosProgress, [0, 1], [1, 0]);
  const scale = interpolate(progress, [0, 1], [0.9, 1])
    * interpolate(chaosProgress, [0, 1], [1, 0.85]);
  // Subtle shake during chaos collapse
  const shake = chaosProgress > 0 && chaosProgress < 0.5
    ? Math.sin(chaosProgress * 40) * 3
    : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: `calc(50% + ${x + shake}px)`,
        top: `calc(50% + ${y}px)`,
        transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`,
        width: w,
        opacity,
        background: colors.bgCard,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textTertiary, marginLeft: 4 }}>
          {title}
        </span>
      </div>
      {/* Fake content lines */}
      <div style={{ padding: '12px 14px' }}>
        {[0.7, 0.5, 0.9, 0.4, 0.6].map((w2, i) => (
          <div
            key={i}
            style={{
              height: 6,
              width: `${w2 * 100}%`,
              background: colors.border,
              borderRadius: 3,
              marginBottom: 6,
              opacity: 0.5,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export const ProblemStatement: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lineDelay = 30; // frames between each line

  // Cursor blink
  const cursorVisible = Math.floor(frame / 15) % 2 === 0;

  // Chaos collapse starts at frame 170 — gives time to read last line
  const chaosStart = 170;
  const chaosProgress = spring({
    frame: frame - chaosStart,
    fps,
    config: { damping: 14, stiffness: 60 },
  });

  // Main terminal also fades during collapse
  const mainTerminalOpacity = interpolate(chaosProgress, [0, 0.6, 1], [1, 1, 0]);
  const mainTerminalScale = interpolate(chaosProgress, [0, 1], [1, 0.96]);

  // Solution reveal — appears after chaos finishes collapsing
  const solutionProgress = spring({
    frame: frame - 195,
    fps,
    config: { damping: 12, stiffness: 60 },
  });
  const solutionOpacity = interpolate(solutionProgress, [0, 1], [0, 1]);
  const solutionScale = interpolate(solutionProgress, [0, 1], [0.92, 1]);
  const solutionY = interpolate(solutionProgress, [0, 1], [20, 0]);

  // Background dot pattern pulse
  const bgPulse = interpolate(Math.sin(frame / 25), [-1, 1], [0.02, 0.04]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Subtle dot grid background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,${bgPulse}) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, rgba(168,85,247,0.06) 0%, transparent 70%)`,
          opacity: interpolate(chaosProgress, [0, 1], [1, 0]),
        }}
      />

      {/* Chaos terminal windows (behind the main terminal) */}
      {chaosWindows.map((win, i) => {
        const winProgress = spring({
          frame: frame - win.delay,
          fps,
          config: { damping: 16, stiffness: 80 },
        });
        return (
          <MiniTerminal
            key={i}
            x={win.x}
            y={win.y}
            rot={win.rot}
            w={win.w}
            title={win.title}
            progress={winProgress}
            chaosProgress={chaosProgress}
          />
        );
      })}

      {/* Main terminal — front and center */}
      <div
        style={{
          position: 'relative',
          width: 1100,
          background: colors.bgCard,
          border: `1px solid rgba(255,255,255,0.08)`,
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: `${glow(colors.accentPurple, 80, 0.1)}, 0 20px 60px rgba(0,0,0,0.4)`,
          opacity: mainTerminalOpacity,
          transform: `scale(${mainTerminalScale})`,
          zIndex: 10,
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 18px',
            borderBottom: `1px solid rgba(255,255,255,0.06)`,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 13,
              color: colors.textTertiary,
              marginLeft: 8,
            }}
          >
            sound-familiar.sh
          </span>
        </div>

        {/* Problem lines */}
        <div style={{ padding: '28px 36px' }}>
          {problems.map((problem, i) => {
            const lineFrame = frame - (i * lineDelay + 15);
            const lineProgress = spring({
              frame: lineFrame,
              fps,
              config: { damping: 16, stiffness: 120 },
            });
            const lineOpacity = interpolate(lineProgress, [0, 1], [0, 1]);
            const lineX = interpolate(lineProgress, [0, 1], [-15, 0]);

            // Typewriter
            const charsToShow = Math.min(
              problem.text.length,
              Math.max(0, Math.floor((lineFrame / fps) * 45))
            );
            const displayText = problem.text.slice(0, charsToShow);
            const showCursor = charsToShow < problem.text.length && lineFrame > 0;

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  marginBottom: 22,
                  opacity: lineOpacity,
                  transform: `translateX(${lineX}px)`,
                }}
              >
                <span
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 20,
                    color: colors.accentPink,
                    lineHeight: 1.5,
                    flexShrink: 0,
                  }}
                >
                  {'>'}
                </span>
                <span
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 20,
                    color: colors.textSecondary,
                    lineHeight: 1.5,
                  }}
                >
                  {displayText}
                  {showCursor && cursorVisible && (
                    <span style={{ color: colors.accentPurple }}>|</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Solution reveal — appears after chaos collapses */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          opacity: solutionOpacity,
          transform: `scale(${solutionScale}) translateY(${solutionY}px)`,
          zIndex: 20,
        }}
      >
        <div
          style={{
            ...gradientText(),
            fontFamily: fonts.display,
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          There&apos;s a better way.
        </div>
        {/* Subtle glow line under text */}
        <div
          style={{
            width: 200,
            height: 2,
            borderRadius: 1,
            background: `linear-gradient(90deg, transparent, ${colors.accentPurple}, ${colors.accentPink}, transparent)`,
            opacity: 0.4,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
