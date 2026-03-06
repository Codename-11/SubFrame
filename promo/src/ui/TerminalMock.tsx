import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { app, fonts } from '../theme';
import { TerminalGridMock } from './TerminalGridMock';

/**
 * Simplified SubFrame terminal area — tab bar + terminal content.
 * Faithfully recreates TerminalTabBar + viewport with optional grid mode.
 *
 * Tab bar layout (matching the real app):
 *   [Terminal tabs...] [spacer] [usage bar] [+ button] [grid icon] [panel toggles...]
 */

interface Tab {
  name: string;
  active: boolean;
}

const defaultTabs: Tab[] = [
  { name: 'Claude Code', active: true },
  { name: 'Terminal 2', active: false },
  { name: 'dev server', active: false },
];

const workTabs: Tab[] = [
  { name: 'Claude Code', active: true },
  { name: 'api server', active: false },
  { name: 'logs', active: false },
];

const tabsByWorkspace = [defaultTabs, workTabs];

interface PanelToggle {
  label: string;
  icon: string;
  active: boolean;
}

const panelToggles: PanelToggle[] = [
  { label: 'Tasks', icon: '☰', active: true },
  { label: 'GitHub', icon: '◈', active: false },
  { label: 'Overview', icon: '▣', active: false },
];

interface TerminalLine {
  type: 'prompt' | 'output' | 'success' | 'info' | 'dim';
  text: string;
  delay: number;
}

const terminalLines: TerminalLine[] = [
  { type: 'prompt', text: '~/SubFrame $ claude', delay: 0 },
  { type: 'dim', text: 'Claude Code v1.0.41 — SubFrame session', delay: 20 },
  { type: 'prompt', text: '> Refactor the settings panel to use tabs', delay: 45 },
  { type: 'info', text: '  Reading src/renderer/components/SettingsPanel.tsx...', delay: 65 },
  { type: 'info', text: '  Reading src/renderer/components/ui/tabs.tsx...', delay: 80 },
  { type: 'output', text: '  Restructuring 7 settings sections into tabbed layout', delay: 100 },
  { type: 'success', text: '  ✓ Updated SettingsPanel.tsx (General, AI Tool, Terminal,', delay: 125 },
  { type: 'success', text: '    Editor, Appearance, Updater, About)', delay: 125 },
  { type: 'dim', text: '  3 files changed, 142 insertions(+), 89 deletions(-)', delay: 150 },
];

export const TerminalMock: React.FC<{
  animateIn?: boolean;
  showTabBar?: boolean;
  showUsage?: boolean;
  /** If set, switches to grid mode at this frame offset */
  gridAt?: number;
  /** Which panel toggle index is currently active (0=Tasks, 1=GitHub, 2=Overview) */
  activePanelIndex?: number;
  /** Which workspace's terminals to show (0=Default, 1=Work) */
  workspaceIndex?: number;
  /** Frame at which to expand grid to 4x4 (only for workspace 1) */
  expandGridAt?: number;
}> = ({ animateIn = true, showTabBar = true, showUsage = true, gridAt, activePanelIndex = 0, workspaceIndex = 0, expandGridAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = animateIn
    ? spring({ frame, fps, config: { damping: 14, stiffness: 80 } })
    : 1;

  const cursorVisible = Math.floor(frame / 16) % 2 === 0;

  // Usage bar animation
  const usagePercent = 34;
  const usageWidth = interpolate(
    spring({ frame: frame - 10, fps, config: { damping: 20, stiffness: 60 } }),
    [0, 1],
    [0, usagePercent]
  );

  // Grid mode
  const useGrid = gridAt !== undefined && frame >= gridAt;

  // Grid icon highlight when switching
  const gridIconActive = useGrid;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: app.bgDeep,
        opacity: interpolate(enterProgress, [0, 1], [0, 1]),
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {/* Tab bar */}
      {showTabBar && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 36,
            background: app.bgSecondary,
            borderBottom: `1px solid ${app.border}`,
            padding: '0 4px',
            gap: 2,
            flexShrink: 0,
          }}
        >
          {/* Terminal tabs */}
          {(tabsByWorkspace[workspaceIndex] || tabsByWorkspace[0]).map((tab) => (
            <div
              key={tab.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 28,
                padding: '0 12px',
                borderRadius: 6,
                fontSize: 12,
                fontFamily: fonts.display,
                color: tab.active ? app.accent : app.textSecondary,
                background: tab.active ? app.bgTertiary : 'transparent',
                border: tab.active
                  ? `1px solid rgba(212, 165, 116, 0.2)`
                  : '1px solid transparent',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.name}
              {!tab.active && (
                <span style={{ fontSize: 10, color: app.textMuted, opacity: 0.4 }}>×</span>
              )}
            </div>
          ))}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Usage bar */}
          {showUsage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '2px 10px',
                background: app.bgTertiary,
                border: `1px solid ${app.border}`,
                borderRadius: 6,
                marginRight: 4,
              }}
            >
              <span style={{ fontFamily: fonts.mono, fontSize: 10, color: app.textTertiary }}>
                5h
              </span>
              <div
                style={{
                  width: 40,
                  height: 5,
                  borderRadius: 3,
                  background: app.bgDeep,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${usageWidth}%`,
                    height: '100%',
                    borderRadius: 3,
                    background: app.success,
                  }}
                />
              </div>
              <span style={{ fontFamily: fonts.mono, fontSize: 10, color: app.success }}>
                {Math.round(usageWidth)}%
              </span>
            </div>
          )}

          {/* New terminal + button */}
          <div
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              color: app.textTertiary,
              fontSize: 16,
            }}
          >
            +
          </div>

          {/* Grid layout toggle */}
          <div
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: fonts.mono,
              color: gridIconActive ? app.accent : app.textTertiary,
              background: gridIconActive ? app.accentSubtle : 'transparent',
              border: gridIconActive
                ? `1px solid rgba(212, 165, 116, 0.2)`
                : '1px solid transparent',
            }}
          >
            ⊞
          </div>

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 18,
              background: app.border,
              margin: '0 4px',
            }}
          />

          {/* Panel toggle buttons */}
          {panelToggles.map((toggle, i) => {
            const isActive = i === activePanelIndex;
            return (
              <div
                key={toggle.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  height: 28,
                  padding: '0 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: fonts.display,
                  color: isActive ? app.accent : app.textSecondary,
                  background: isActive ? app.accentSubtle : 'transparent',
                  border: isActive
                    ? `1px solid rgba(212, 165, 116, 0.2)`
                    : '1px solid transparent',
                }}
              >
                <span style={{ fontSize: 11 }}>{toggle.icon}</span>
                {toggle.label}
              </div>
            );
          })}
        </div>
      )}

      {/* Terminal content — single pane or grid */}
      {useGrid ? (
        <TerminalGridMock splitAt={0} gridAppearsAt={gridAt!} workspaceIndex={workspaceIndex} expandAt={expandGridAt} />
      ) : (
        <div
          style={{
            flex: 1,
            padding: '16px 20px',
            fontFamily: fonts.mono,
            fontSize: 13,
            lineHeight: 1.7,
            overflow: 'hidden',
          }}
        >
          {terminalLines.map((line, i) => {
            const lineVisible = frame >= line.delay;
            if (!lineVisible) return null;
            const lineAge = frame - line.delay;
            const charsPerFrame = 2.5;
            const charsToShow = Math.min(line.text.length, Math.floor(lineAge * charsPerFrame));
            const displayText = line.text.slice(0, charsToShow);
            const isTyping = charsToShow < line.text.length;

            const colorMap: Record<string, string> = {
              prompt: app.accent,
              output: app.textPrimary,
              success: app.success,
              info: app.info,
              dim: app.textTertiary,
            };

            return (
              <div key={i} style={{ color: colorMap[line.type], minHeight: 22 }}>
                {displayText}
                {isTyping && line.type === 'prompt' && cursorVisible && (
                  <span style={{ color: app.accent }}>█</span>
                )}
              </div>
            );
          })}

          {frame > 170 && (
            <div style={{ color: app.accent, marginTop: 4 }}>
              ~/SubFrame ${' '}
              {cursorVisible && <span>█</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
