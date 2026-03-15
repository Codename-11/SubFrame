import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { colors, fonts, glow, gradientText } from '../theme';

/**
 * Scene 2: Problem Statement (~14.5 seconds = 435 frames @ 30fps)
 *
 * Visual chaos → clean resolution.
 * Each pain point types out, pauses, then shifts to red/warning.
 * Chaos terminals pile up behind. Everything collapses, then
 * "There's a better way." appears.
 *
 * Timeline:
 *   0-15:    First terminal fades in
 *   15-55:   Line 1 types → pause → red shift
 *   80-117:  Line 2 types → pause → red shift
 *   145-180: Line 3 types → pause → red shift
 *   210-249: Line 4 types → cursor blinks on last line
 *   249-300: Hold with blinking cursor — let it sink in
 *   300-330: Chaos windows shake subtly, then fade/scale out
 *   345-375: "There's a better way." springs in with gradient glow
 *   375-400: Hold on solution
 *   400-435: Fade out to black for smooth transition to AppDemo
 */

const problems = [
  { text: 'Five terminal windows open. None of them are the right one...' },
  { text: 'Want to try Codex or Gemini? Start over in a new setup...' },
  { text: 'Every context switch costs you 15 minutes of flow...' },
  { text: "You're gluing together tools that should just work together..." },
];

// Background chaos terminals — tilted, overlapping, scattered around the screen
const chaosWindows = [
  { x: -520, y: -180, rot: -6, w: 480, title: 'bash — npm run dev', delay: 0 },
  { x: 480, y: -140, rot: 5, w: 440, title: 'node — server.js', delay: 10 },
  { x: -440, y: 120, rot: 3, w: 420, title: 'zsh — ~/projects', delay: 20 },
  { x: 540, y: 160, rot: -4, w: 460, title: 'Terminal 4', delay: 30 },
  { x: -80, y: -260, rot: -2, w: 500, title: 'claude — api-server', delay: 15 },
  { x: 60, y: 240, rot: 2, w: 460, title: 'docker compose logs', delay: 25 },
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
  const opacity = interpolate(progress, [0, 1], [0, 0.55])
    * interpolate(chaosProgress, [0, 1], [1, 0]);
  const scale = interpolate(progress, [0, 1], [0.85, 1])
    * interpolate(chaosProgress, [0, 1], [1, 0.8]);
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
        <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>
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

  const lineDelay = 65; // frames between each line start (type ~40f + ~25f pause)

  // Block cursor blink — 530ms on / 530ms off at 30fps ≈ 16 frames
  const cursorVisible = Math.floor(frame / 16) % 2 === 0;

  // Chaos collapse starts at frame 300 — ~1.7s after last line finishes
  const chaosStart = 300;
  const chaosProgress = spring({
    frame: frame - chaosStart,
    fps,
    config: { damping: 16, stiffness: 50 },
  });

  // Main terminal also fades during collapse
  const mainTerminalOpacity = interpolate(chaosProgress, [0, 0.5, 1], [1, 0.8, 0]);
  const mainTerminalScale = interpolate(chaosProgress, [0, 1], [1, 0.94]);

  // Solution reveal — appears as collapse finishes
  const solutionProgress = spring({
    frame: frame - 325,
    fps,
    config: { damping: 14, stiffness: 50 },
  });
  const solutionOpacity = interpolate(solutionProgress, [0, 1], [0, 1]);
  const solutionScale = interpolate(solutionProgress, [0, 1], [0.88, 1]);
  const solutionY = interpolate(solutionProgress, [0, 1], [30, 0]);

  // Fade out at end of scene for smooth transition to AppDemo
  const fadeOut = interpolate(frame, [400, 435], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Background dot pattern pulse
  const bgPulse = interpolate(Math.sin(frame / 25), [-1, 1], [0.02, 0.04]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: fadeOut,
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
            const lineStartFrame = i * lineDelay + 15;
            const lineFrame = frame - lineStartFrame;
            const lineProgress = spring({
              frame: lineFrame,
              fps,
              config: { damping: 16, stiffness: 120 },
            });
            const lineOpacity = interpolate(lineProgress, [0, 1], [0, 1]);
            const lineX = interpolate(lineProgress, [0, 1], [-15, 0]);

            // Typewriter — 45 chars/sec
            const charsToShow = Math.min(
              problem.text.length,
              Math.max(0, Math.floor((lineFrame / fps) * 45))
            );
            const displayText = problem.text.slice(0, charsToShow);
            const isTyping = charsToShow < problem.text.length && lineFrame > 0;
            const isFinished = charsToShow >= problem.text.length;
            const isLastLine = i === problems.length - 1;

            // How many frames since this line finished typing
            const typingDuration = Math.ceil((problem.text.length / 45) * fps);
            const finishedAt = lineStartFrame + typingDuration;
            const framesSinceFinished = Math.max(0, frame - finishedAt);

            // Red/warning color shift — fades in ~10 frames after line finishes
            // (not on the last line — that one stays neutral with blinking cursor)
            const warningProgress = !isLastLine && isFinished
              ? interpolate(framesSinceFinished, [5, 18], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })
              : 0;

            // Interpolate text color: secondary → warning red
            const textColor = warningProgress > 0
              ? `color-mix(in srgb, ${colors.textSecondary} ${Math.round((1 - warningProgress) * 100)}%, #e05555)`
              : colors.textSecondary;

            // Prompt arrow also shifts to red
            const promptColor = warningProgress > 0
              ? `color-mix(in srgb, ${colors.accentPink} ${Math.round((1 - warningProgress) * 100)}%, #d44040)`
              : colors.accentPink;

            // Cursor shows while typing, or blinks on last line until chaos
            const showBlockCursor = isTyping || (isLastLine && isFinished && frame < chaosStart);

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
                    fontSize: 24,
                    color: promptColor,
                    lineHeight: 1.5,
                    flexShrink: 0,
                  }}
                >
                  {'>'}
                </span>
                <span
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 24,
                    color: textColor,
                    lineHeight: 1.5,
                  }}
                >
                  {displayText}
                  {showBlockCursor && (
                    <span
                      style={{
                        color: colors.accentPurple,
                        opacity: cursorVisible ? 1 : 0,
                      }}
                    >
                      █
                    </span>
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
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          There&apos;s a better way.
        </div>
        {/* Subtle glow line under text */}
        <div
          style={{
            width: 260,
            height: 3,
            borderRadius: 2,
            background: `linear-gradient(90deg, transparent, ${colors.accentPurple}, ${colors.accentPink}, transparent)`,
            opacity: 0.6,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
