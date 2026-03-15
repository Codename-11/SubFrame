import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { app, fonts } from '../theme';

/**
 * SubFrame terminal grid — 2x2 split panes with simultaneous typing.
 * Recreates the real TerminalGrid component with independent terminal content.
 */

interface GridPane {
  name: string;
  lines: { text: string; color: string; delay: number }[];
}

// Default workspace — SubFrame project terminals
const defaultPanes: GridPane[] = [
  {
    name: 'Claude Code',
    lines: [
      { text: '$ claude', color: app.accent, delay: 0 },
      { text: '> Reading AGENTS.md...', color: app.textTertiary, delay: 15 },
      { text: '> Session started. How can I help?', color: app.textTertiary, delay: 30 },
      { text: '$ fix the sidebar layout bug', color: app.accent, delay: 50 },
      { text: "  I'll look at the Sidebar component...", color: app.info, delay: 70 },
      { text: '  Reading src/renderer/components/Sidebar.tsx', color: app.info, delay: 85 },
    ],
  },
  {
    name: 'dev server',
    lines: [
      { text: '$ npm run dev', color: app.accent, delay: 5 },
      { text: '  esbuild: watching...', color: app.textTertiary, delay: 20 },
      { text: '  Main process compiled (1.2s)', color: app.success, delay: 35 },
      { text: '  Renderer bundled (0.8s)', color: app.success, delay: 45 },
      { text: '  Electron ready on port 5173', color: app.success, delay: 55 },
      { text: '  HMR connected', color: app.textTertiary, delay: 65 },
    ],
  },
  {
    name: 'git',
    lines: [
      { text: '$ git status', color: app.accent, delay: 10 },
      { text: '  On branch feature/terminal-grid', color: app.textTertiary, delay: 25 },
      { text: '  Changes not staged:', color: app.warning, delay: 35 },
      { text: '    modified: Sidebar.tsx', color: app.error, delay: 42 },
      { text: '    modified: TerminalGrid.tsx', color: app.error, delay: 48 },
      { text: '$ git diff --stat', color: app.accent, delay: 70 },
    ],
  },
  {
    name: 'tests',
    lines: [
      { text: '$ npm test', color: app.accent, delay: 15 },
      { text: '  vitest v2.1.0', color: app.textTertiary, delay: 30 },
      { text: '  taskMarkdownParser (8 tests)', color: app.success, delay: 45 },
      { text: '  ipcChannels (12 tests)', color: app.success, delay: 55 },
      { text: '  pipelineStages (6 tests)', color: app.success, delay: 65 },
      { text: '  All 26 tests passed', color: app.success, delay: 80 },
    ],
  },
];

// Work workspace — api-server project terminals (16 panes for 4x4 demo)
const workPanes: GridPane[] = [
  {
    name: 'Claude Code',
    lines: [
      { text: '$ claude', color: app.accent, delay: 0 },
      { text: '> api-server session ready', color: app.textTertiary, delay: 12 },
      { text: '$ add rate limiting', color: app.accent, delay: 28 },
      { text: '  Reading routes/users.ts', color: app.info, delay: 40 },
    ],
  },
  {
    name: 'api server',
    lines: [
      { text: '$ npm run serve', color: app.accent, delay: 5 },
      { text: '  Fastify v4.28', color: app.textTertiary, delay: 15 },
      { text: '  Routes: 24 endpoints', color: app.success, delay: 25 },
      { text: '  Listening on :3001', color: app.success, delay: 35 },
    ],
  },
  {
    name: 'logs',
    lines: [
      { text: '$ tail -f access.log', color: app.accent, delay: 8 },
      { text: '  GET /health 200 2ms', color: app.textTertiary, delay: 20 },
      { text: '  POST /auth 200 48ms', color: app.textTertiary, delay: 32 },
      { text: '  WARN rate limit hit', color: app.warning, delay: 44 },
    ],
  },
  {
    name: 'tests',
    lines: [
      { text: '$ npm test --watch', color: app.accent, delay: 10 },
      { text: '  jest v29.7', color: app.textTertiary, delay: 22 },
      { text: '  28 tests passed', color: app.success, delay: 36 },
    ],
  },
  // Row 2 extras (appear on 3x3 / 4x4 expansion)
  {
    name: 'billing-svc',
    lines: [
      { text: '$ npm run dev', color: app.accent, delay: 3 },
      { text: '  Stripe webhook ready', color: app.success, delay: 18 },
      { text: '  Listening on :3002', color: app.success, delay: 28 },
    ],
  },
  {
    name: 'redis',
    lines: [
      { text: '$ redis-cli monitor', color: app.accent, delay: 6 },
      { text: '  OK', color: app.success, delay: 14 },
      { text: '  GET session:a1b2', color: app.textTertiary, delay: 24 },
      { text: '  SET ratelimit:ip', color: app.textTertiary, delay: 34 },
    ],
  },
  {
    name: 'docker',
    lines: [
      { text: '$ docker compose ps', color: app.accent, delay: 4 },
      { text: '  postgres  Up 2h', color: app.success, delay: 16 },
      { text: '  redis     Up 2h', color: app.success, delay: 22 },
      { text: '  nginx     Up 2h', color: app.success, delay: 28 },
    ],
  },
  {
    name: 'migrations',
    lines: [
      { text: '$ npx prisma migrate', color: app.accent, delay: 7 },
      { text: '  Applied: add_rate_limits', color: app.success, delay: 22 },
      { text: '  DB is up to date', color: app.textTertiary, delay: 32 },
    ],
  },
  // Row 3 extras (appear on 3x3 expansion)
  {
    name: 'infra',
    lines: [
      { text: '$ terraform plan', color: app.accent, delay: 5 },
      { text: '  Refreshing state...', color: app.textTertiary, delay: 18 },
      { text: '  0 to add, 0 to change', color: app.success, delay: 30 },
    ],
  },
];

const panesByWorkspace = [defaultPanes, workPanes];

const TerminalPane: React.FC<{
  pane: GridPane;
  isActive: boolean;
  /** Frame offset — typing starts from this frame instead of 0 */
  frameOffset: number;
}> = ({ pane, isActive, frameOffset }) => {
  const frame = useCurrentFrame();
  const relFrame = frame - frameOffset;
  const cursorOn = Math.floor(frame / 16) % 2 === 0;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: app.bgDeep,
        border: isActive
          ? `1px solid rgba(212, 165, 116, 0.2)`
          : `1px solid ${app.border}`,
        borderRadius: 4,
        overflow: 'hidden',
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {/* Pane header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderBottom: `1px solid ${app.border}`,
          background: isActive ? 'rgba(212, 165, 116, 0.04)' : 'transparent',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: isActive ? app.accent : app.textMuted,
          }}
        />
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 10,
            color: isActive ? app.accent : app.textTertiary,
          }}
        >
          {pane.name}
        </span>
      </div>

      {/* Terminal content */}
      <div
        style={{
          flex: 1,
          padding: '8px 10px',
          fontFamily: fonts.mono,
          fontSize: 10,
          lineHeight: 1.7,
          overflow: 'hidden',
        }}
      >
        {pane.lines.map((line, i) => {
          if (relFrame < line.delay) return null;
          const age = relFrame - line.delay;
          const chars = Math.min(line.text.length, Math.floor(age * 2));
          const isTyping = chars < line.text.length;
          return (
            <div key={i} style={{ color: line.color, whiteSpace: 'nowrap' }}>
              {line.text.slice(0, chars)}
              {isTyping && line.color === app.accent && cursorOn && (
                <span style={{ color: app.accent }}>|</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Asymmetric layout slot placements — CSS Grid row/column assignments */
const ASYMMETRIC_SLOTS: Record<string, { gridRow: string; gridColumn: string }[]> = {
  '2L1R': [
    { gridRow: '1', gridColumn: '1' },
    { gridRow: '2', gridColumn: '1' },
    { gridRow: '1 / span 2', gridColumn: '2' },
  ],
  '1L2R': [
    { gridRow: '1 / span 2', gridColumn: '1' },
    { gridRow: '1', gridColumn: '2' },
    { gridRow: '2', gridColumn: '2' },
  ],
  '2T1B': [
    { gridRow: '1', gridColumn: '1' },
    { gridRow: '1', gridColumn: '2' },
    { gridRow: '2', gridColumn: '1 / span 2' },
  ],
  '1T2B': [
    { gridRow: '1', gridColumn: '1 / span 2' },
    { gridRow: '2', gridColumn: '1' },
    { gridRow: '2', gridColumn: '2' },
  ],
};

export const TerminalGridMock: React.FC<{
  /** Frame at which the grid splits from single to 2x2 */
  splitAt?: number;
  /** Absolute frame when the grid first appears — typing starts from here */
  gridAppearsAt?: number;
  /** Which workspace's terminals to show (0=Default, 1=Work) */
  workspaceIndex?: number;
  /** Grid columns (default 2) */
  gridCols?: number;
  /** Grid rows (default 2) */
  gridRows?: number;
  /** Frame at which the grid layout changed — triggers staggered fade-in for new panes */
  layoutChangedAt?: number;
  /** Layout name string like '2x2', '2L1R', etc. */
  gridLayout?: string;
}> = ({ splitAt = 0, gridAppearsAt = 0, workspaceIndex = 0, gridCols = 2, gridRows = 2, layoutChangedAt, gridLayout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Grid reveal animation
  const gridProgress = spring({
    frame: frame - splitAt,
    fps,
    config: { damping: 16, stiffness: 60 },
  });

  const panes = panesByWorkspace[workspaceIndex] || panesByWorkspace[0];
  const showGrid = frame >= splitAt;
  const gridGap = interpolate(gridProgress, [0, 1], [0, 4]);

  // Detect asymmetric layout
  const asymSlots = gridLayout ? ASYMMETRIC_SLOTS[gridLayout] : undefined;
  const totalPanes = asymSlots ? asymSlots.length : gridRows * gridCols;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: app.bgDeep,
        overflow: 'hidden',
      }}
    >
      {!showGrid ? (
        <TerminalPane pane={panes[0]} isActive frameOffset={0} />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: asymSlots ? '1fr 1fr' : `repeat(${gridCols}, 1fr)`,
            gridTemplateRows: asymSlots ? '1fr 1fr' : `repeat(${gridRows}, 1fr)`,
            gap: gridGap,
            padding: gridGap,
          }}
        >
          {Array.from({ length: totalPanes }).map((_, idx) => {
            const pane = panes[idx % panes.length];
            const isActive = idx === 0;
            // For asymmetric layouts, all panes are "new" at layoutChangedAt
            // For NxN layouts, panes beyond the original 4 fade in when layout changes
            const isNewPane = asymSlots
              ? (layoutChangedAt !== undefined)
              : idx >= 4;
            const paneOffset = isNewPane && layoutChangedAt !== undefined
              ? layoutChangedAt
              : gridAppearsAt;

            let paneOpacity = 1;
            if (isNewPane && layoutChangedAt !== undefined) {
              const stagger = layoutChangedAt + (asymSlots ? idx : (idx - 4)) * 4;
              const paneProgress = spring({
                frame: frame - stagger,
                fps,
                config: { damping: 14, stiffness: 100 },
              });
              paneOpacity = interpolate(paneProgress, [0, 1], [0, 1]);
            }

            // Apply asymmetric CSS grid placement if applicable
            const slotStyle = asymSlots?.[idx];

            return (
              <div
                key={idx}
                style={{
                  opacity: paneOpacity,
                  minWidth: 0,
                  minHeight: 0,
                  display: 'flex',
                  ...(slotStyle ? { gridRow: slotStyle.gridRow, gridColumn: slotStyle.gridColumn } : {}),
                }}
              >
                <TerminalPane pane={pane} isActive={isActive} frameOffset={paneOffset} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
