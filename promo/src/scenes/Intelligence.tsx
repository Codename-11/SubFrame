import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { app, colors, fonts, gradientText } from '../theme';
import { AtomLogo } from '../AtomLogo';

/**
 * Scene: Hooks & Context (7 seconds = 210 frames @ 30fps)
 *
 * Animated node graph showing SubFrame's persistent context system.
 * Center: SubFrame atom logo
 * Top ring: 4 file nodes (AGENTS.md, STRUCTURE.json, PROJECT_NOTES.md, tasks.json)
 * Bottom ring: 3 hook nodes (SessionStart, UserPrompt, Stop)
 * Connectors draw themselves, glowing dots travel the paths.
 *
 * Timeline:
 *   0-15:    Title "Built-in Intelligence" fades in
 *   10-70:   Center logo springs in, file nodes appear one by one
 *   40-100:  Connectors draw from files → center, dots start traveling inward
 *   90-140:  Hook nodes appear below, connectors draw outward, dots travel out
 *   140-170: Tagline fades in
 *   170-210: Hold
 */

// ─── Data ────────────────────────────────────────────────────────────────────

interface FileNode {
  name: string;
  desc: string;
  color: string;
  /** Angle in degrees from center (0 = right, 90 = down) */
  angle: number;
  radius: number;
}

const fileNodes: FileNode[] = [
  { name: 'AGENTS.md', desc: 'Session memory', color: app.success, angle: -55, radius: 300 },
  { name: 'STRUCTURE.json', desc: 'Module map', color: app.accent, angle: -125, radius: 300 },
  { name: 'PROJECT_NOTES.md', desc: 'Decisions', color: app.info, angle: -155, radius: 320 },
  { name: 'tasks.json', desc: 'Work tracking', color: colors.accentPurple, angle: -25, radius: 320 },
];

interface HookNode {
  name: string;
  desc: string;
  color: string;
  angle: number;
  radius: number;
}

const hookNodes: HookNode[] = [
  { name: 'SessionStart', desc: 'Injects context', color: app.success, angle: 35, radius: 280 },
  { name: 'UserPrompt', desc: 'Matches sub-tasks', color: app.accent, angle: 90, radius: 300 },
  { name: 'Stop', desc: 'Tracks progress', color: app.warning, angle: 145, radius: 280 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CX = 960; // center X (1920/2)
const CY = 460; // center Y (slightly above middle for tagline space)

function nodePos(angle: number, radius: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

/** Get a point along the line from outer node toward center, stopping at `stopRadius` from center */
function connectorEndpoint(angle: number, stopRadius: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  return { x: CX + stopRadius * Math.cos(rad), y: CY + stopRadius * Math.sin(rad) };
}

const LOGO_CLEAR_RADIUS = 90; // connectors stop this far from center

/** Animated connector line with drawing effect + traveling dot */
const Connector: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  /** 0-1 progress of the draw animation */
  drawProgress: number;
  /** 0-1 progress of the traveling dot (cycles) */
  dotProgress: number;
  /** Direction: true = dot travels from (x1,y1)→(x2,y2) */
  inward?: boolean;
}> = ({ x1, y1, x2, y2, color, drawProgress, dotProgress, inward = true }) => {
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const dashOffset = len * (1 - Math.min(1, drawProgress));

  // Dot position along the path
  const t = inward ? dotProgress : 1 - dotProgress;
  const dotX = x1 + (x2 - x1) * t;
  const dotY = y1 + (y2 - y1) * t;
  const showDot = drawProgress > 0.5 && dotProgress > 0;

  return (
    <>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={2}
        strokeDasharray={`5 4`}
        strokeOpacity={0.25 * Math.min(1, drawProgress * 2)}
      />
      {/* Solid draw-in line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={2}
        strokeDasharray={len}
        strokeDashoffset={dashOffset}
        strokeOpacity={0.5}
      />
      {/* Traveling dot */}
      {showDot && (
        <circle
          cx={dotX}
          cy={dotY}
          r={4.5}
          fill={color}
          opacity={0.9}
        />
      )}
      {/* Dot glow */}
      {showDot && (
        <circle
          cx={dotX}
          cy={dotY}
          r={12}
          fill={color}
          opacity={0.15}
        />
      )}
    </>
  );
};

/** A node card (file or hook) */
const NodeCard: React.FC<{
  x: number;
  y: number;
  name: string;
  desc: string;
  color: string;
  progress: number;
  isMono?: boolean;
}> = ({ x, y, name, desc, color, progress, isMono = true }) => {
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const scale = interpolate(progress, [0, 1], [0.8, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 18px',
        background: app.bgSecondary,
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
        whiteSpace: 'nowrap',
        boxShadow: `0 0 20px ${color}10`,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: isMono ? fonts.mono : fonts.display,
            fontSize: 18,
            fontWeight: 600,
            color: color,
            lineHeight: 1.3,
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 15,
            color: app.textSecondary,
            lineHeight: 1.3,
          }}
        >
          {desc}
        </div>
      </div>
    </div>
  );
};

// ─── Scene ───────────────────────────────────────────────────────────────────

export const Intelligence: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Title ──
  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80 },
  });
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [10, 0]);

  // ── Center logo ──
  const logoProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 12, stiffness: 60 },
  });
  const logoScale = interpolate(logoProgress, [0, 1], [0.4, 1]);
  const logoOpacity = interpolate(logoProgress, [0, 1], [0, 1]);

  // Center glow pulse
  const glowPulse = interpolate(Math.sin(frame / 20), [-1, 1], [0.4, 0.8]);

  // ── File nodes (staggered) ──
  const fileDelays = [20, 32, 44, 56];

  // ── Hook nodes (staggered, later) ──
  const hookDelays = [90, 102, 114];

  // ── Connector timing ──
  // File connectors start drawing at frame 40
  const fileConnectorStart = 40;
  // Hook connectors start at frame 100
  const hookConnectorStart = 100;

  // Dot cycling — loop every 60 frames
  const dotCycle = (startFrame: number) => {
    const rel = frame - startFrame;
    if (rel < 0) return 0;
    return (rel % 36) / 36;
  };

  // ── Tagline ──
  const taglineProgress = spring({
    frame: frame - 145,
    fps,
    config: { damping: 14, stiffness: 80 },
  });
  const taglineOpacity = interpolate(taglineProgress, [0, 1], [0, 1]);
  const taglineY = interpolate(taglineProgress, [0, 1], [12, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        fontFamily: fonts.display,
      }}
    >
      {/* Background ambient glow */}
      <div
        style={{
          position: 'absolute',
          left: CX - 400,
          top: CY - 250,
          width: 800,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, rgba(180,128,255,0.03) 0%, rgba(255,110,180,0.02) 40%, transparent 70%)`,
          opacity: glowPulse,
        }}
      />

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          width: '100%',
          textAlign: 'center',
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <span
          style={{
            ...gradientText(),
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          Hooks & Context
        </span>
      </div>

      {/* SVG layer for connectors */}
      <svg
        style={{ position: 'absolute', inset: 0, width: 1920, height: 1080 }}
        viewBox="0 0 1920 1080"
      >
        {/* File → Center connectors (stop short of logo) */}
        {fileNodes.map((node, i) => {
          const pos = nodePos(node.angle, node.radius);
          const end = connectorEndpoint(node.angle, LOGO_CLEAR_RADIUS);
          const drawRel = frame - (fileConnectorStart + i * 8);
          const drawProg = spring({
            frame: drawRel,
            fps,
            config: { damping: 20, stiffness: 40 },
          });
          return (
            <Connector
              key={`fc-${i}`}
              x1={pos.x}
              y1={pos.y}
              x2={end.x}
              y2={end.y}
              color={node.color}
              drawProgress={drawProg}
              dotProgress={dotCycle(fileConnectorStart + i * 8 + 20)}
              inward
            />
          );
        })}

        {/* Center → Hook connectors (start from logo edge) */}
        {hookNodes.map((node, i) => {
          const start = connectorEndpoint(node.angle, LOGO_CLEAR_RADIUS);
          const pos = nodePos(node.angle, node.radius);
          const drawRel = frame - (hookConnectorStart + i * 8);
          const drawProg = spring({
            frame: drawRel,
            fps,
            config: { damping: 20, stiffness: 40 },
          });
          return (
            <Connector
              key={`hc-${i}`}
              x1={start.x}
              y1={start.y}
              x2={pos.x}
              y2={pos.y}
              color={node.color}
              drawProgress={drawProg}
              dotProgress={dotCycle(hookConnectorStart + i * 8 + 20)}
              inward={false}
            />
          );
        })}

        {/* Center glow rings */}
        <circle
          cx={CX}
          cy={CY}
          r={75}
          fill="none"
          stroke="rgba(255, 110, 180, 0.08)"
          strokeWidth={1.5}
          opacity={logoOpacity * glowPulse}
        />
        <circle
          cx={CX}
          cy={CY}
          r={100}
          fill="none"
          stroke="rgba(180, 128, 255, 0.05)"
          strokeWidth={1}
          opacity={logoOpacity * glowPulse * 0.6}
        />
      </svg>

      {/* Center logo backdrop — solid dark circle to clear connector clutter */}
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: CY,
          width: LOGO_CLEAR_RADIUS * 2,
          height: LOGO_CLEAR_RADIUS * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.bg} 60%, transparent 100%)`,
          transform: 'translate(-50%, -50%)',
          opacity: logoOpacity,
        }}
      />

      {/* Center logo */}
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: CY,
          transform: `translate(-50%, -50%) scale(${logoScale})`,
          opacity: logoOpacity,
        }}
      >
        <AtomLogo size={120} />
      </div>

      {/* "SubFrame" label under logo */}
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: CY + 72,
          transform: 'translateX(-50%)',
          opacity: logoOpacity,
          fontFamily: fonts.display,
          fontSize: 16,
          fontWeight: 600,
          color: app.textSecondary,
          letterSpacing: '0.08em',
          textAlign: 'center',
        }}
      >
        SUBFRAME
      </div>

      {/* File nodes */}
      {fileNodes.map((node, i) => {
        const pos = nodePos(node.angle, node.radius);
        const progress = spring({
          frame: frame - fileDelays[i],
          fps,
          config: { damping: 14, stiffness: 80 },
        });
        return (
          <NodeCard
            key={`f-${i}`}
            x={pos.x}
            y={pos.y}
            name={node.name}
            desc={node.desc}
            color={node.color}
            progress={progress}
            isMono
          />
        );
      })}

      {/* Group labels */}
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: CY - 190,
          transform: 'translateX(-50%)',
          opacity: interpolate(
            spring({ frame: frame - 18, fps, config: { damping: 14, stiffness: 80 } }),
            [0, 1], [0, 0.5]
          ),
          fontFamily: fonts.mono,
          fontSize: 13,
          fontWeight: 600,
          color: app.textTertiary,
          letterSpacing: '0.12em',
        }}
      >
        PROJECT FILES
      </div>
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: CY + 155,
          transform: 'translateX(-50%)',
          opacity: interpolate(
            spring({ frame: frame - 88, fps, config: { damping: 14, stiffness: 80 } }),
            [0, 1], [0, 0.5]
          ),
          fontFamily: fonts.mono,
          fontSize: 13,
          fontWeight: 600,
          color: app.textTertiary,
          letterSpacing: '0.12em',
        }}
      >
        HOOKS
      </div>

      {/* Hook nodes */}
      {hookNodes.map((node, i) => {
        const pos = nodePos(node.angle, node.radius);
        const progress = spring({
          frame: frame - hookDelays[i],
          fps,
          config: { damping: 14, stiffness: 80 },
        });
        return (
          <NodeCard
            key={`h-${i}`}
            x={pos.x}
            y={pos.y}
            name={node.name}
            desc={node.desc}
            color={node.color}
            progress={progress}
            isMono={false}
          />
        );
      })}

      {/* Tagline */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          width: '100%',
          textAlign: 'center',
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
        }}
      >
        <div
          style={{
            fontSize: 30,
            fontWeight: 500,
            color: app.textSecondary,
            letterSpacing: '-0.01em',
          }}
        >
          Context that persists.{' '}
          <span style={{ color: app.textPrimary, fontWeight: 600 }}>
            AI that remembers.
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
