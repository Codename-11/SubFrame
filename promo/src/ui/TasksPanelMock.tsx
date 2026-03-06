import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { app, fonts } from '../theme';

/**
 * Simplified SubFrame tasks panel — right sidebar with task list, status badges,
 * step progress, and action icons. Matches the real TasksPanel table view.
 */

interface MockTask {
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  category: string;
  steps?: { done: number; total: number };
}

const tasks: MockTask[] = [
  {
    title: 'Warp-style terminal UX',
    status: 'in_progress',
    priority: 'high',
    category: 'feature',
    steps: { done: 4, total: 6 },
  },
  {
    title: 'OG image for social previews',
    status: 'completed',
    priority: 'medium',
    category: 'docs',
  },
  {
    title: 'Pipeline execution engine',
    status: 'in_progress',
    priority: 'high',
    category: 'feature',
    steps: { done: 2, total: 5 },
  },
  {
    title: 'Transport abstraction layer',
    status: 'pending',
    priority: 'medium',
    category: 'refactor',
  },
  {
    title: 'Code signing for macOS/Win',
    status: 'pending',
    priority: 'low',
    category: 'chore',
  },
];

const statusConfig = {
  pending: { bg: 'rgba(113, 113, 122, 0.3)', text: '#d4d4d8', label: 'Pending' },
  in_progress: { bg: 'rgba(120, 53, 15, 0.4)', text: '#fcd34d', label: 'In Progress' },
  completed: { bg: 'rgba(6, 78, 59, 0.4)', text: '#6ee7b7', label: 'Done' },
};

const priorityConfig = {
  high: { bg: 'rgba(127, 29, 29, 0.4)', text: '#fca5a5' },
  medium: { bg: 'rgba(120, 53, 15, 0.4)', text: '#fcd34d' },
  low: { bg: 'rgba(63, 63, 70, 0.5)', text: '#d4d4d8' },
};

const categoryConfig: Record<string, { bg: string; text: string }> = {
  feature: { bg: 'rgba(76, 29, 149, 0.4)', text: '#c4b5fd' },
  enhancement: { bg: 'rgba(49, 46, 129, 0.4)', text: '#a5b4fc' },
  docs: { bg: 'rgba(30, 58, 138, 0.4)', text: '#93c5fd' },
  refactor: { bg: 'rgba(22, 78, 99, 0.4)', text: '#67e8f9' },
  chore: { bg: 'rgba(63, 63, 70, 0.5)', text: '#d4d4d8' },
};

const Badge: React.FC<{ bg: string; text: string; label: string; small?: boolean }> = ({
  bg,
  text,
  label,
  small,
}) => (
  <span
    style={{
      display: 'inline-block',
      padding: small ? '1px 6px' : '2px 8px',
      borderRadius: 4,
      background: bg,
      color: text,
      fontSize: small ? 9 : 10,
      fontWeight: 500,
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </span>
);

export const TasksPanelMock: React.FC<{
  width?: number;
  animateIn?: boolean;
}> = ({ width = 380, animateIn = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = animateIn
    ? spring({ frame, fps, config: { damping: 14, stiffness: 80 } })
    : 1;
  const panelOpacity = interpolate(enterProgress, [0, 1], [0, 1]);
  const panelX = interpolate(enterProgress, [0, 1], [20, 0]);

  // Status filter pills
  const filters = [
    { label: 'All', count: 5, active: true },
    { label: 'Active', count: 2, active: false },
    { label: 'Pending', count: 2, active: false },
    { label: 'Done', count: 1, active: false },
  ];

  return (
    <div
      style={{
        width,
        height: '100%',
        background: app.bgPrimary,
        borderLeft: `1px solid ${app.border}`,
        display: 'flex',
        flexDirection: 'column',
        opacity: panelOpacity,
        transform: `translateX(${panelX}px)`,
        fontFamily: fonts.display,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: `1px solid ${app.border}`,
        }}
      >
        <span
          style={{ fontSize: 13, fontWeight: 600, color: app.textPrimary }}
        >
          Sub-Tasks
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* View toggle icons */}
          {['≡', '▦', '◎'].map((icon, i) => (
            <div
              key={i}
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                fontSize: 12,
                color: i === 0 ? app.accent : app.textTertiary,
                background: i === 0 ? app.accentSubtle : 'transparent',
                border:
                  i === 0
                    ? `1px solid rgba(212, 165, 116, 0.2)`
                    : '1px solid transparent',
              }}
            >
              {icon}
            </div>
          ))}
        </div>
      </div>

      {/* Search + Filters */}
      <div style={{ padding: '8px 14px 4px' }}>
        {/* Search bar */}
        <div
          style={{
            height: 28,
            padding: '0 10px',
            borderRadius: 6,
            background: app.bgDeep,
            border: `1px solid ${app.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 12, color: app.textMuted }}>⌕</span>
          <span style={{ fontSize: 12, color: app.textMuted }}>
            Search tasks...
          </span>
        </div>

        {/* Filter pills */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: app.bgDeep,
            borderRadius: 6,
            padding: 2,
          }}
        >
          {filters.map((f) => (
            <div
              key={f.label}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                fontSize: 11,
                color: f.active ? app.accent : app.textTertiary,
                background: f.active ? app.accentSubtle : 'transparent',
                cursor: 'default',
              }}
            >
              {f.label}
              <span style={{ marginLeft: 4, opacity: 0.6 }}>{f.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, padding: '4px 0', overflow: 'hidden' }}>
        {tasks.map((task, i) => {
          const itemProgress = animateIn
            ? spring({
                frame: frame - (20 + i * 12),
                fps,
                config: { damping: 16, stiffness: 100 },
              })
            : 1;
          const itemOpacity = interpolate(itemProgress, [0, 1], [0, 1]);

          const sc = statusConfig[task.status];
          const pc = priorityConfig[task.priority];
          const cc = categoryConfig[task.category] ?? categoryConfig.chore;

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 14px',
                borderBottom: `1px solid ${app.border}`,
                opacity: itemOpacity,
              }}
            >
              {/* Expand arrow placeholder */}
              <span
                style={{
                  fontSize: 10,
                  color: app.textMuted,
                  marginTop: 3,
                  flexShrink: 0,
                }}
              >
                ▸
              </span>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: app.textPrimary,
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {task.title}
                </div>

                {/* Badges row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    flexWrap: 'wrap',
                  }}
                >
                  <Badge bg={sc.bg} text={sc.text} label={sc.label} />
                  <Badge
                    bg={pc.bg}
                    text={pc.text}
                    label={task.priority}
                    small
                  />
                  <Badge
                    bg={cc.bg}
                    text={cc.text}
                    label={task.category}
                    small
                  />
                  {task.steps && (
                    <span
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 10,
                        color: app.textTertiary,
                        marginLeft: 4,
                      }}
                    >
                      {task.steps.done}/{task.steps.total}
                    </span>
                  )}
                </div>
              </div>

              {/* Action icons */}
              <div
                style={{
                  display: 'flex',
                  gap: 2,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {task.status === 'in_progress' && (
                  <span style={{ fontSize: 12, color: app.success }}>✓</span>
                )}
                {task.status === 'pending' && (
                  <span style={{ fontSize: 12, color: app.accent }}>▶</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add task button */}
      <div style={{ padding: '8px 14px 12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '7px 12px',
            borderRadius: 6,
            background: app.accentSubtle,
            border: `1px solid rgba(212, 165, 116, 0.2)`,
            color: app.accent,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          + New Sub-Task
        </div>
      </div>
    </div>
  );
};
