import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { app, colors, fonts, gradientText } from '../theme';

/**
 * Scene: Architecture (7 seconds = 210 frames @ 30fps)
 *
 * Three-tier architecture diagram using the same visual language as Intelligence.
 * HTML node cards with SVG connectors + traveling dots.
 *
 * Layout:
 *   Top tier:    Main Process modules (PTY, Tasks, AI Tools, Pipeline, Settings)
 *   Center:      IPC Bridge — glowing horizontal line with bidirectional dots
 *   Bottom tier: Renderer modules (Terminal, Panels, Command Palette, Stores, Hooks)
 *
 * Timeline:
 *   0-10:    Title fades in
 *   8-30:    IPC bridge line draws horizontally
 *   15-60:   Main process label + modules spring in (staggered)
 *   40-85:   Renderer label + modules spring in (staggered)
 *   50+:     Vertical connectors draw from modules to IPC bridge
 *   70+:     Traveling dots cycle along connectors
 *   150-180: Tagline fades in
 *   180-210: Hold
 */

// ─── Data ────────────────────────────────────────────────────────────────────

interface ModuleNode {
  label: string;
  sub: string;
  color: string;
}

const mainModules: ModuleNode[] = [
  { label: 'PTY Manager', sub: 'Terminal processes', color: colors.accentCyan },
  { label: 'Tasks Manager', sub: 'Markdown + YAML', color: colors.accentPurple },
  { label: 'AI Tools', sub: 'Claude · Codex · Gemini', color: app.success },
  { label: 'Pipeline', sub: 'Workflow engine', color: app.accent },
  { label: 'Settings', sub: 'Preferences + themes', color: app.warning },
];

const rendererModules: ModuleNode[] = [
  { label: 'Terminal Grid', sub: 'Multi-pane PTY', color: colors.accentCyan },
  { label: 'Panels', sub: 'Tasks · Overview · Git', color: colors.accentPurple },
  { label: 'Command Palette', sub: 'Quick navigation', color: app.accent },
  { label: 'Zustand Stores', sub: 'Reactive state', color: colors.accentPink },
  { label: 'TanStack Query', sub: 'IPC caching', color: app.info },
];

// ─── Layout constants ────────────────────────────────────────────────────────

const CX = 960;
const IPC_Y = 480; // center line Y
const MAIN_Y = 280; // main process tier Y
const RENDERER_Y = 680; // renderer tier Y
const MODULE_START_X = 220; // first module X
const MODULE_GAP = 370; // gap between modules

function moduleX(index: number): number {
  return MODULE_START_X + index * MODULE_GAP;
}

// ─── Components ──────────────────────────────────────────────────────────────

const ModuleCard: React.FC<{
  x: number;
  y: number;
  label: string;
  sub: string;
  color: string;
  progress: number;
}> = ({ x, y, label, sub, color, progress }) => {
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const scale = interpolate(progress, [0, 1], [0.85, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        padding: '10px 18px',
        background: app.bgSecondary,
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
        whiteSpace: 'nowrap',
        boxShadow: `0 0 20px ${color}10`,
      }}
    >
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 18,
          fontWeight: 600,
          color,
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 13,
          color: app.textSecondary,
          lineHeight: 1.3,
        }}
      >
        {sub}
      </div>
    </div>
  );
};

/** Vertical connector line (no dots — dots handled by FlowDot routes) */
const VerticalConnector: React.FC<{
  x: number;
  y1: number;
  y2: number;
  color: string;
  drawProgress: number;
}> = ({ x, y1, y2, color, drawProgress }) => {
  const len = Math.abs(y2 - y1);
  const dashOffset = len * (1 - Math.min(1, drawProgress));

  return (
    <>
      <line
        x1={x}
        y1={y1}
        x2={x}
        y2={y2}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="5 4"
        strokeOpacity={0.2 * Math.min(1, drawProgress * 2)}
      />
      <line
        x1={x}
        y1={y1}
        x2={x}
        y2={y2}
        stroke={color}
        strokeWidth={2}
        strokeDasharray={len}
        strokeDashoffset={dashOffset}
        strokeOpacity={0.5}
      />
    </>
  );
};

/**
 * A dot that flows a full route: main module → down to IPC → across bridge → down to renderer.
 * Path segments: vertical down, horizontal across, vertical down.
 * `t` is 0-1 progress along the entire route.
 */
const FlowDot: React.FC<{
  /** X of the starting main-process module column */
  fromX: number;
  /** X of the destination renderer module column */
  toX: number;
  /** 0-1 progress along entire route */
  t: number;
  color: string;
  show: boolean;
}> = ({ fromX, toX, t, color, show }) => {
  if (!show || t <= 0) return null;

  // Three segments of roughly equal visual weight:
  // Seg 1: vertical down from MAIN_Y+30 to IPC_Y      (200px)
  // Seg 2: horizontal from fromX to toX on IPC_Y       (variable)
  // Seg 3: vertical down from IPC_Y to RENDERER_Y-30   (200px)
  const seg1Len = IPC_Y - (MAIN_Y + 30); // 170
  const seg2Len = Math.abs(toX - fromX); // variable
  const seg3Len = (RENDERER_Y - 30) - IPC_Y; // 170
  const totalLen = seg1Len + seg2Len + seg3Len;

  const dist = t * totalLen;
  let dotX: number;
  let dotY: number;

  if (dist <= seg1Len) {
    // Segment 1: vertical down
    dotX = fromX;
    dotY = (MAIN_Y + 30) + dist;
  } else if (dist <= seg1Len + seg2Len) {
    // Segment 2: horizontal across IPC bridge
    const hDist = dist - seg1Len;
    const dir = toX > fromX ? 1 : -1;
    dotX = fromX + dir * hDist;
    dotY = IPC_Y;
  } else {
    // Segment 3: vertical down to renderer
    const vDist = dist - seg1Len - seg2Len;
    dotX = toX;
    dotY = IPC_Y + vDist;
  }

  return (
    <>
      <circle cx={dotX} cy={dotY} r={4} fill={color} opacity={0.85} />
      <circle cx={dotX} cy={dotY} r={11} fill={color} opacity={0.12} />
    </>
  );
};

// ─── Scene ───────────────────────────────────────────────────────────────────

export const Architecture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Title ──
  const titleProgress = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [10, 0]);

  // ── IPC Bridge line ──
  const ipcDrawProgress = spring({
    frame: frame - 8,
    fps,
    config: { damping: 20, stiffness: 40 },
  });
  const ipcLineWidth = interpolate(ipcDrawProgress, [0, 1], [0, 1680]);
  const ipcGlow = interpolate(Math.sin(frame / 18), [-1, 1], [0.3, 0.6]);

  // ── Module timing ──
  const mainDelays = mainModules.map((_, i) => 15 + i * 8);
  const rendererDelays = rendererModules.map((_, i) => 40 + i * 8);

  // Connector timing — starts after modules appear
  const mainConnStart = 50;
  const rendererConnStart = 70;

  // Flow dot routes: each route goes from a main module column → across IPC → to a renderer column
  // Staggered starts, different cycle lengths for organic feel
  const flowRoutes = [
    { fromIdx: 0, toIdx: 2, startFrame: 80, period: 70, color: mainModules[0].color },
    { fromIdx: 2, toIdx: 0, startFrame: 90, period: 65, color: mainModules[2].color },
    { fromIdx: 1, toIdx: 3, startFrame: 100, period: 75, color: mainModules[1].color },
    { fromIdx: 4, toIdx: 1, startFrame: 95, period: 68, color: mainModules[4].color },
    { fromIdx: 3, toIdx: 4, startFrame: 110, period: 72, color: mainModules[3].color },
    { fromIdx: 2, toIdx: 3, startFrame: 115, period: 60, color: rendererModules[2].color },
  ];

  // ── Tier labels ──
  const mainLabelProgress = spring({
    frame: frame - 12,
    fps,
    config: { damping: 14, stiffness: 80 },
  });
  const rendererLabelProgress = spring({
    frame: frame - 37,
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  // ── Tagline ──
  const taglineProgress = spring({
    frame: frame - 150,
    fps,
    config: { damping: 14, stiffness: 80 },
  });
  const taglineOpacity = interpolate(taglineProgress, [0, 1], [0, 1]);
  const taglineY = interpolate(taglineProgress, [0, 1], [12, 0]);

  // Background pulse
  const bgPulse = interpolate(Math.sin(frame / 30), [-1, 1], [0.3, 0.6]);

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
          left: CX - 500,
          top: IPC_Y - 300,
          width: 1000,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, rgba(168,85,247,0.03) 0%, rgba(100,216,255,0.02) 40%, transparent 70%)`,
          opacity: bgPulse,
        }}
      />

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 50,
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
          Under the Hood
        </span>
      </div>

      {/* SVG layer — IPC bridge + vertical connectors */}
      <svg
        style={{ position: 'absolute', inset: 0, width: 1920, height: 1080 }}
        viewBox="0 0 1920 1080"
      >
        {/* IPC Bridge — horizontal glowing line */}
        <line
          x1={CX - ipcLineWidth / 2}
          y1={IPC_Y}
          x2={CX + ipcLineWidth / 2}
          y2={IPC_Y}
          stroke={colors.accentPurple}
          strokeWidth={2.5}
          strokeOpacity={0.4}
        />
        {/* IPC glow */}
        <line
          x1={CX - ipcLineWidth / 2}
          y1={IPC_Y}
          x2={CX + ipcLineWidth / 2}
          y2={IPC_Y}
          stroke={colors.accentPurple}
          strokeWidth={8}
          strokeOpacity={ipcGlow * 0.08}
        />

        {/* Main process → IPC connectors (lines only) */}
        {mainModules.map((mod, i) => {
          const x = moduleX(i);
          const drawProg = spring({
            frame: frame - (mainConnStart + i * 6),
            fps,
            config: { damping: 20, stiffness: 50 },
          });
          return (
            <VerticalConnector
              key={`mc-${i}`}
              x={x}
              y1={MAIN_Y + 30}
              y2={IPC_Y}
              color={mod.color}
              drawProgress={drawProg}
            />
          );
        })}

        {/* Renderer → IPC connectors (lines only) */}
        {rendererModules.map((mod, i) => {
          const x = moduleX(i);
          const drawProg = spring({
            frame: frame - (rendererConnStart + i * 6),
            fps,
            config: { damping: 20, stiffness: 50 },
          });
          return (
            <VerticalConnector
              key={`rc-${i}`}
              x={x}
              y1={IPC_Y}
              y2={RENDERER_Y - 30}
              color={mod.color}
              drawProgress={drawProg}
            />
          );
        })}

        {/* Routed flow dots — travel full path: main → IPC bridge → renderer */}
        {flowRoutes.map((route, i) => {
          const rel = frame - route.startFrame;
          if (rel < 0) return null;
          const t = (rel % route.period) / route.period;
          return (
            <FlowDot
              key={`flow-${i}`}
              fromX={moduleX(route.fromIdx)}
              toX={moduleX(route.toIdx)}
              t={t}
              color={route.color}
              show={ipcDrawProgress > 0.5}
            />
          );
        })}
      </svg>

      {/* IPC Bridge label */}
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: IPC_Y,
          transform: 'translate(-50%, -50%)',
          opacity: interpolate(ipcDrawProgress, [0.3, 0.7], [0, 1]),
          padding: '6px 20px',
          background: colors.bg,
          borderRadius: 20,
          border: `1px solid rgba(168, 85, 247, 0.3)`,
        }}
      >
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 15,
            fontWeight: 600,
            color: colors.accentPurple,
            letterSpacing: '0.06em',
          }}
        >
          TYPED IPC BRIDGE
        </span>
      </div>

      {/* Main Process tier label */}
      <div
        style={{
          position: 'absolute',
          left: 70,
          top: MAIN_Y,
          transform: 'translateY(-50%)',
          opacity: interpolate(mainLabelProgress, [0, 1], [0, 0.6]),
        }}
      >
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 14,
            fontWeight: 600,
            color: colors.accentPurple,
            letterSpacing: '0.1em',
            marginBottom: 4,
          }}
        >
          MAIN PROCESS
        </div>
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 12,
            color: app.textTertiary,
          }}
        >
          Node.js + Electron
        </div>
      </div>

      {/* Renderer tier label */}
      <div
        style={{
          position: 'absolute',
          left: 70,
          top: RENDERER_Y,
          transform: 'translateY(-50%)',
          opacity: interpolate(rendererLabelProgress, [0, 1], [0, 0.6]),
        }}
      >
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 14,
            fontWeight: 600,
            color: colors.accentPink,
            letterSpacing: '0.1em',
            marginBottom: 4,
          }}
        >
          RENDERER
        </div>
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 12,
            color: app.textTertiary,
          }}
        >
          React 19 + TypeScript
        </div>
      </div>

      {/* Main process modules */}
      {mainModules.map((mod, i) => {
        const progress = spring({
          frame: frame - mainDelays[i],
          fps,
          config: { damping: 14, stiffness: 80 },
        });
        return (
          <ModuleCard
            key={`m-${i}`}
            x={moduleX(i)}
            y={MAIN_Y}
            label={mod.label}
            sub={mod.sub}
            color={mod.color}
            progress={progress}
          />
        );
      })}

      {/* Renderer modules */}
      {rendererModules.map((mod, i) => {
        const progress = spring({
          frame: frame - rendererDelays[i],
          fps,
          config: { damping: 14, stiffness: 80 },
        });
        return (
          <ModuleCard
            key={`r-${i}`}
            x={moduleX(i)}
            y={RENDERER_Y}
            label={mod.label}
            sub={mod.sub}
            color={mod.color}
            progress={progress}
          />
        );
      })}

      {/* Tagline */}
      <div
        style={{
          position: 'absolute',
          bottom: 65,
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
          Electron. React. TypeScript.{' '}
          <span style={{ color: app.textPrimary, fontWeight: 600 }}>
            Fully typed end to end.
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
