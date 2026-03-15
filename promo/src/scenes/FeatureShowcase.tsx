import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { app, colors, fonts, glow, gradientText, site } from '../theme';

/**
 * Scene 4: Feature Showcase
 * 3 key features with mini-UI mocks + additional feature pills below.
 */

// ─── Mini UI Mocks (card-sized, simplified) ─────────────────────────────────

/** Terminal mock — shows a Claude Code session */
const TerminalCardMock: React.FC = () => {
  const frame = useCurrentFrame();
  const lines = [
    { prompt: true, text: 'claude "refactor auth module"', color: app.accent, delay: 0 },
    { prompt: false, text: '  Analyzing 12 files...', color: app.info, delay: 20 },
    { prompt: false, text: '  Restructuring into tabbed layout', color: app.textSecondary, delay: 35 },
    { prompt: false, text: '  3 files changed, 142 ins(+)', color: app.success, delay: 55 },
  ];

  const cursorOn = Math.floor(frame / 16) % 2 === 0;

  return (
    <div
      style={{
        background: app.bgDeep,
        borderRadius: 8,
        padding: '12px 14px',
        fontFamily: fonts.mono,
        fontSize: 13,
        lineHeight: 1.8,
        border: `1px solid ${app.border}`,
      }}
    >
      {/* Mini tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: `1px solid ${app.border}`,
        }}
      >
        <span
          style={{
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 4,
            background: app.bgTertiary,
            color: app.accent,
            border: `1px solid rgba(212,165,116,0.2)`,
          }}
        >
          Claude Code
        </span>
        <span style={{ fontSize: 12, padding: '2px 8px', color: app.textTertiary }}>
          Terminal 2
        </span>
      </div>

      {lines.map((line, i) => {
        const visible = frame > line.delay;
        if (!visible) return null;
        const age = frame - line.delay;
        const chars = Math.min(line.text.length, Math.floor(age * 2));
        return (
          <div key={i} style={{ color: line.color }}>
            {line.prompt && <span style={{ color: app.textMuted }}>$ </span>}
            {line.text.slice(0, chars)}
            {line.prompt && chars < line.text.length && cursorOn && (
              <span style={{ color: app.accent }}>|</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** Task panel mock — shows a mini task list with status badges */
const TaskCardMock: React.FC = () => {
  const frame = useCurrentFrame();
  const tasks = [
    { title: 'Terminal UX overhaul', status: 'in_progress' as const, steps: '4/6' },
    { title: 'Pipeline engine', status: 'in_progress' as const, steps: '2/5' },
    { title: 'OG image', status: 'completed' as const, steps: null },
    { title: 'Transport layer', status: 'pending' as const, steps: null },
  ];

  const statusColors = {
    in_progress: { bg: 'rgba(120,53,15,0.4)', text: '#fcd34d' },
    completed: { bg: 'rgba(6,78,59,0.4)', text: '#6ee7b7' },
    pending: { bg: 'rgba(63,63,70,0.3)', text: '#d4d4d8' },
  };

  return (
    <div
      style={{
        background: app.bgDeep,
        borderRadius: 8,
        padding: '10px 12px',
        fontFamily: fonts.display,
        fontSize: 13,
        border: `1px solid ${app.border}`,
      }}
    >
      {/* Mini filter pills */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: `1px solid ${app.border}`,
        }}
      >
        {['All', 'Active', 'Pending'].map((f, i) => (
          <span
            key={f}
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 12,
              color: i === 0 ? app.accent : app.textMuted,
              background: i === 0 ? app.accentSubtle : 'transparent',
            }}
          >
            {f}
          </span>
        ))}
      </div>

      {tasks.map((task, i) => {
        const visible = frame > i * 10;
        const sc = statusColors[task.status];
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 4px',
              opacity: visible ? 1 : 0,
              borderBottom: i < tasks.length - 1 ? `1px solid ${app.border}` : 'none',
            }}
          >
            <span style={{ color: app.textMuted, fontSize: 10 }}>-</span>
            <span
              style={{
                flex: 1,
                color: app.textPrimary,
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {task.title}
            </span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 3,
                background: sc.bg,
                color: sc.text,
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              {task.status === 'in_progress' ? 'Active' : task.status === 'completed' ? 'Done' : 'Pending'}
            </span>
            {task.steps && (
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  color: app.textTertiary,
                  flexShrink: 0,
                }}
              >
                {task.steps}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** Pipeline mock — shows a workflow with stages running */
const PipelineCardMock: React.FC = () => {
  const frame = useCurrentFrame();

  const stages = [
    { name: 'typecheck', status: 'done' as const, time: '4.2s' },
    { name: 'lint', status: 'done' as const, time: '2.1s' },
    { name: 'test', status: 'running' as const, time: null },
    { name: 'build', status: 'pending' as const, time: null },
  ];

  const statusStyle = {
    done: { bg: 'rgba(6,78,59,0.4)', text: '#6ee7b7', icon: 'ok' },
    running: { bg: 'rgba(120,53,15,0.4)', text: '#fcd34d', icon: '..' },
    pending: { bg: 'rgba(63,63,70,0.3)', text: '#d4d4d8', icon: '--' },
  };

  // Animated progress dots for running stage
  const dots = '.'.repeat((Math.floor(frame / 10) % 3) + 1);

  return (
    <div
      style={{
        background: app.bgDeep,
        borderRadius: 8,
        padding: '10px 12px',
        fontFamily: fonts.display,
        fontSize: 13,
        border: `1px solid ${app.border}`,
      }}
    >
      {/* Workflow header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: `1px solid ${app.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 12, color: app.accent }}>
            &gt;
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: app.textPrimary }}>
            ci-pipeline.yml
          </span>
        </div>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 3,
            background: 'rgba(120,53,15,0.4)',
            color: '#fcd34d',
            fontSize: 11,
          }}
        >
          Running
        </span>
      </div>

      {/* Stage list with connecting lines */}
      {stages.map((stage, i) => {
        const visible = frame > i * 12;
        const ss = statusStyle[stage.status];
        return (
          <div
            key={stage.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 4px',
              opacity: visible ? 1 : 0,
            }}
          >
            {/* Status indicator */}
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: ss.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                color: ss.text,
                fontFamily: fonts.mono,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {stage.status === 'done' ? 'ok' : stage.status === 'running' ? dots.charAt(0) : '--'}
            </div>
            {/* Connector line */}
            {i < stages.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: 19,
                  marginTop: 24,
                  width: 1,
                  height: 8,
                  background: app.border,
                }}
              />
            )}
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 13,
                color: stage.status === 'running' ? app.accent : app.textPrimary,
                flex: 1,
              }}
            >
              {stage.name}
              {stage.status === 'running' && (
                <span style={{ color: app.textTertiary }}>{dots}</span>
              )}
            </span>
            {stage.time && (
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  color: app.textMuted,
                  flexShrink: 0,
                }}
              >
                {stage.time}
              </span>
            )}
          </div>
        );
      })}

      {/* Progress bar */}
      <div
        style={{
          marginTop: 8,
          paddingTop: 6,
          borderTop: `1px solid ${app.border}`,
        }}
      >
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: app.bgTertiary,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${interpolate(frame, [0, 120], [50, 75], { extrapolateRight: 'clamp' })}%`,
              height: '100%',
              borderRadius: 2,
              background: `linear-gradient(90deg, ${app.success}, ${app.accent})`,
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 3,
            fontSize: 11,
            color: app.textMuted,
          }}
        >
          <span>2/4 stages</span>
          <span>~12s remaining</span>
        </div>
      </div>
    </div>
  );
};

// ─── Feature Data ────────────────────────────────────────────────────────────

interface Feature {
  title: string;
  description: string;
  icon: string;
  color: string;
  mockUI: React.FC;
}

const features: Feature[] = [
  {
    title: 'AI-Native Terminal',
    description: 'Claude, Gemini, and Codex — enhanced, not replaced',
    icon: '>_',
    color: site.accentPurple,
    mockUI: TerminalCardMock,
  },
  {
    title: 'Sub-Task Tracking',
    description: 'Markdown-powered tasks with step checklists',
    icon: '[]',
    color: site.accentPink,
    mockUI: TaskCardMock,
  },
  {
    title: 'Pipeline Workflows',
    description: 'YAML-driven CI stages with live progress tracking',
    icon: '>>',
    color: site.accentCyan,
    mockUI: PipelineCardMock,
  },
];

// Additional features (shown as pills below the cards)
const moreFeatures = [
  { label: 'Terminal Grid', icon: '#', desc: 'Asymmetric layouts' },
  { label: 'Command Palette', icon: '/', desc: 'Quick actions' },
  { label: 'Project Overview', icon: '=', desc: 'Stats & charts' },
  { label: 'Activity Streams', icon: '~', desc: 'Live output logs' },
  { label: 'Built-in Editor', icon: '¶', desc: 'Find/replace & tabs' },
  { label: 'Prompt Library', icon: '"', desc: 'Reusable prompts' },
  { label: 'Multi-Workspace', icon: '+', desc: 'Switch projects' },
  { label: 'Theme System', icon: '*', desc: '4 presets + custom' },
];

// ─── Feature Card ────────────────────────────────────────────────────────────

const FeatureCard: React.FC<{ feature: Feature; index: number }> = ({
  feature,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterDelay = index * 20;
  const progress = spring({
    frame: frame - enterDelay,
    fps,
    config: { damping: 14, stiffness: 80 },
  });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [40, 0]);

  const MockUI = feature.mockUI;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        width: 400,
        background: colors.bgCard,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: 22,
        boxShadow: glow(feature.color, 30, 0.06),
      }}
    >
      {/* Icon + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 22,
            fontWeight: 700,
            color: feature.color,
          }}
        >
          {feature.icon}
        </span>
        <span
          style={{
            fontFamily: fonts.display,
            fontSize: 22,
            fontWeight: 600,
            color: colors.textPrimary,
          }}
        >
          {feature.title}
        </span>
      </div>

      {/* Description */}
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 16,
          color: colors.textSecondary,
          marginBottom: 14,
          lineHeight: 1.5,
        }}
      >
        {feature.description}
      </div>

      {/* Mock UI */}
      <MockUI />
    </div>
  );
};

// ─── Scene ───────────────────────────────────────────────────────────────────

export const FeatureShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100 },
  });
  const headerOpacity = interpolate(headerProgress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 50,
      }}
    >
      {/* Section header */}
      <div
        style={{
          ...gradientText(),
          fontFamily: fonts.display,
          fontSize: 44,
          fontWeight: 700,
          opacity: headerOpacity,
          marginBottom: 36,
          letterSpacing: '-0.02em',
        }}
      >
        Built for How You Actually Work
      </div>

      {/* Feature cards row */}
      <div style={{ display: 'flex', gap: 28, marginBottom: 36 }}>
        {features.map((feature, i) => (
          <FeatureCard key={i} feature={feature} index={i} />
        ))}
      </div>

      {/* "Plus" section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          width: 1100,
          marginBottom: 16,
          opacity: interpolate(
            spring({ frame: frame - 75, fps, config: { damping: 16, stiffness: 100 } }),
            [0, 1],
            [0, 1]
          ),
        }}
      >
        <div style={{ flex: 1, height: 1, background: colors.border }} />
        <span
          style={{
            fontFamily: fonts.display,
            fontSize: 15,
            color: colors.textSecondary,
            fontWeight: 500,
            letterSpacing: '0.05em',
          }}
        >
          AND MORE
        </span>
        <div style={{ flex: 1, height: 1, background: colors.border }} />
      </div>

      {/* Additional features pills */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: 1100,
        }}
      >
        {moreFeatures.map((feat, i) => {
          const pillDelay = 80 + i * 10;
          const pillProgress = spring({
            frame: frame - pillDelay,
            fps,
            config: { damping: 16, stiffness: 100 },
          });
          const pillOpacity = interpolate(pillProgress, [0, 1], [0, 1]);
          const pillY = interpolate(pillProgress, [0, 1], [15, 0]);

          return (
            <div
              key={feat.label}
              style={{
                opacity: pillOpacity,
                transform: `translateY(${pillY}px)`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 16px',
                borderRadius: 8,
                background: colors.bgElevated,
                border: `1px solid ${colors.border}`,
              }}
            >
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 16,
                  color: colors.accentPurple,
                  fontWeight: 700,
                  width: 20,
                  textAlign: 'center',
                }}
              >
                {feat.icon}
              </span>
              <div>
                <div
                  style={{
                    fontFamily: fonts.display,
                    fontSize: 15,
                    fontWeight: 600,
                    color: colors.textPrimary,
                  }}
                >
                  {feat.label}
                </div>
                <div
                  style={{
                    fontFamily: fonts.display,
                    fontSize: 13,
                    color: colors.textSecondary,
                  }}
                >
                  {feat.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
