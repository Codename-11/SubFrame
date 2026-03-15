import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { app, fonts } from '../theme';
import { AtomLogo } from '../AtomLogo';

/**
 * Simplified SubFrame sidebar — faithfully recreates the real app's left panel.
 * Shows: logo, version, tab bar (Projects/Files), workspace selector, project list,
 * git status, action button.
 *
 * Workspace switching: each workspace has its own project set.
 * activeProjectIndex controls which workspace is shown (0 = default, 1 = second).
 */

interface MockProject {
  name: string;
  isSF: boolean;
}

const workspaces: { name: string; projects: MockProject[] }[] = [
  {
    name: 'Default Workspace',
    projects: [
      { name: 'SubFrame', isSF: true },
      { name: 'api-server', isSF: true },
      { name: 'docs-site', isSF: false },
    ],
  },
  {
    name: 'Work',
    projects: [
      { name: 'api-server', isSF: true },
      { name: 'billing-service', isSF: false },
      { name: 'infra-config', isSF: false },
      { name: 'monitoring-dash', isSF: true },
    ],
  },
];

const TAB_ITEMS = ['Projects', 'Files'] as const;

export const SidebarMock: React.FC<{
  width?: number;
  animateIn?: boolean;
  showActivity?: boolean;
  /** Index of the active workspace (0=Default, 1=Work) */
  activeProjectIndex?: number;
}> = ({ width = 260, animateIn = true, showActivity = true, activeProjectIndex = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = animateIn
    ? spring({ frame, fps, config: { damping: 14, stiffness: 80 } })
    : 1;
  const sidebarOpacity = interpolate(enterProgress, [0, 1], [0, 1]);
  const sidebarX = interpolate(enterProgress, [0, 1], [-20, 0]);

  // Current workspace
  const ws = workspaces[activeProjectIndex] || workspaces[0];

  // Staggered project list items
  const projectDelays = ws.projects.map((_, i) => 15 + i * 10);

  // Active project pulse (first project in workspace is always "active")
  const pulseShadow = interpolate(
    Math.sin(frame / 15),
    [-1, 1],
    [0, 3]
  );

  return (
    <div
      style={{
        width,
        height: '100%',
        background: app.bgPrimary,
        borderRight: `1px solid ${app.border}`,
        display: 'flex',
        flexDirection: 'column',
        opacity: sidebarOpacity,
        transform: `translateX(${sidebarX}px)`,
        fontFamily: fonts.display,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header: Logo + branding — matches real Sidebar.tsx layout */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 8px',
          borderBottom: `1px solid ${app.border}`,
        }}
      >
        <div style={{ width: 48, height: 48, flexShrink: 0 }}>
          <AtomLogo size={48} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: app.textPrimary,
              letterSpacing: '-0.01em',
              lineHeight: 1,
            }}
          >
            SubFrame
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 500,
              color: app.warning,
              lineHeight: 1,
            }}
          >
            BETA
          </span>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 10,
              color: app.textMuted,
              lineHeight: 1,
            }}
          >
            v0.5.1-beta
          </span>
        </div>
      </div>

      {/* Tab bar — icons + labels like real app */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: `1px solid ${app.border}`,
        }}
      >
        {TAB_ITEMS.map((tab, i) => (
          <div
            key={tab}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 500,
              color: i === 0 ? app.textPrimary : app.textTertiary,
              borderBottom: i === 0 ? `2px solid ${app.accent}` : '2px solid transparent',
              cursor: 'default',
            }}
          >
            {/* Simple folder/file icon */}
            <span style={{ fontSize: 11, opacity: 0.8 }}>
              {i === 0 ? '📁' : '📄'}
            </span>
            {tab}
          </div>
        ))}
      </div>

      {/* Workspace selector — matches real WorkspaceSelector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderBottom: `1px solid ${app.border}`,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: app.textSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {ws.name}
        </span>
        <span style={{ fontSize: 8, color: app.textMuted, opacity: 0.5 }}>▾</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: app.textTertiary }}>⋯</span>
        <span style={{ fontSize: 12, color: app.textTertiary }}>+</span>
      </div>

      {/* Project list */}
      <div style={{ flex: 1, padding: '4px 0', overflow: 'hidden' }}>
        {ws.projects.map((project, i) => {
          const isActive = i === 0; // first project in workspace is always selected
          const itemProgress = animateIn
            ? spring({
                frame: frame - projectDelays[i],
                fps,
                config: { damping: 16, stiffness: 100 },
              })
            : 1;
          const itemOpacity = interpolate(itemProgress, [0, 1], [0, 1]);
          const itemX = interpolate(itemProgress, [0, 1], [-10, 0]);

          return (
            <div
              key={project.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                background: isActive ? app.accentSubtle : 'transparent',
                opacity: itemOpacity,
                transform: `translateX(${itemX}px)`,
                cursor: 'default',
              }}
            >
              {/* Status dot — green for SF projects, muted otherwise */}
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: project.isSF ? app.success : app.textMuted,
                  boxShadow: isActive && project.isSF
                    ? `0 0 ${pulseShadow}px ${app.success}`
                    : 'none',
                  flexShrink: 0,
                }}
              />
              {/* Project name */}
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? app.textPrimary : app.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {project.name}
              </span>
              {/* SF badge */}
              {project.isSF && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'rgba(124, 179, 130, 0.8)',
                    background: 'rgba(124, 179, 130, 0.15)',
                    padding: '1px 4px',
                    borderRadius: 3,
                    flexShrink: 0,
                  }}
                >
                  SF
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Git status bar */}
      {showActivity && (
        <div
          style={{
            padding: '6px 16px',
            borderTop: `1px solid ${app.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: fonts.mono,
            fontSize: 10,
          }}
        >
          <span style={{ color: app.info }}>main</span>
          <span style={{ color: app.success }}>+3</span>
          <span style={{ color: app.warning }}>~2</span>
          <span style={{ color: app.textMuted }}>?1</span>
        </div>
      )}

      {/* Start AI Tool — split button like real app */}
      <div style={{ padding: '8px 12px 12px', display: 'flex' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: '6px 0 0 6px',
            background: 'rgba(124, 179, 130, 0.15)',
            border: `1px solid rgba(124, 179, 130, 0.2)`,
            borderRight: 'none',
            color: app.success,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'default',
          }}
        >
          Start Claude Code
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 6px',
            borderRadius: '0 6px 6px 0',
            background: 'rgba(124, 179, 130, 0.15)',
            border: `1px solid rgba(124, 179, 130, 0.2)`,
            color: app.success,
            fontSize: 8,
            cursor: 'default',
          }}
        >
          ▾
        </div>
      </div>
    </div>
  );
};
