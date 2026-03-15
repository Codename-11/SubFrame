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
  { label: 'Sub-Tasks', icon: '☰', active: true },
  { label: 'GitHub', icon: '◈', active: false },
  { label: 'Agents', icon: '◉', active: false },
  { label: 'Prompts', icon: '❝', active: false },
  { label: 'Pipeline', icon: '⟩', active: false },
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
  /** Which panel toggle index is currently active (0=Sub-Tasks, 1=GitHub, 2=Agents, 3=Prompts, 4=Pipeline, 5=Overview) */
  activePanelIndex?: number;
  /** Which workspace's terminals to show (0=Default, 1=Work) */
  workspaceIndex?: number;
  /** Grid layout string like '2x2' or '3x3' */
  gridLayout?: string;
  /** Whether to show the grid layout dropdown */
  showGridDropdown?: boolean;
  /** Which dropdown item to highlight (e.g. '3x3') */
  gridDropdownHighlight?: string;
  /** Frame at which grid layout changed (for staggered new-pane fade-in) */
  layoutChangedAt?: number;
  /** Whether to show panel toggle buttons in this tab bar (false when ViewTabBar handles them) */
  showPanelToggles?: boolean;
}> = ({ animateIn = true, showTabBar = true, showUsage = true, gridAt, activePanelIndex = 0, workspaceIndex = 0, gridLayout = '2x2', showGridDropdown = false, gridDropdownHighlight, layoutChangedAt, showPanelToggles = true }) => {
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

          {/* Grid layout toggle + dropdown */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                padding: '0 6px',
                borderRadius: 6,
                fontSize: 11,
                fontFamily: fonts.mono,
                color: gridIconActive ? app.accent : app.textTertiary,
                background: gridIconActive ? app.accentSubtle : 'transparent',
                border: gridIconActive
                  ? `1px solid rgba(212, 165, 116, 0.2)`
                  : '1px solid transparent',
              }}
            >
              <span style={{ fontSize: 11 }}>{gridLayout.includes('x') ? gridLayout.replace('x', '×') : gridLayout}</span>
              <span style={{ fontSize: 8, opacity: 0.5 }}>▼</span>
            </div>

            {/* Grid layout dropdown */}
            {showGridDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: 32,
                  right: 0,
                  width: 64,
                  background: app.bgElevated,
                  border: `1px solid ${app.borderStrong}`,
                  borderRadius: 8,
                  padding: '4px 0',
                  zIndex: 100,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                {['1x2', '2x1', '2x2', '2L1R', '1L2R', '2T1B', '1T2B', '3x2', '3x3'].map((layout) => {
                  const isHighlighted = layout === gridDropdownHighlight;
                  const isCurrent = layout === gridLayout;
                  return (
                    <div
                      key={layout}
                      style={{
                        padding: '5px 12px',
                        fontSize: 11,
                        fontFamily: fonts.mono,
                        textAlign: 'center',
                        color: isCurrent ? app.accent : isHighlighted ? app.textPrimary : app.textSecondary,
                        fontWeight: isCurrent ? 600 : 400,
                        background: isHighlighted
                          ? 'rgba(212, 165, 116, 0.12)'
                          : 'transparent',
                        borderRadius: 4,
                      }}
                    >
                      {layout.includes('x') ? layout.replace('x', '×') : layout}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Divider + Panel toggle buttons (only when not handled by ViewTabBar) */}
          {showPanelToggles && (
            <>
              <div
                style={{
                  width: 1,
                  height: 18,
                  background: app.border,
                  margin: '0 4px',
                }}
              />
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
            </>
          )}
        </div>
      )}

      {/* Terminal content — single pane or grid */}
      {useGrid ? (
        <TerminalGridMock
          splitAt={0}
          gridAppearsAt={gridAt!}
          workspaceIndex={workspaceIndex}
          gridCols={gridLayout.includes('x') ? (parseInt(gridLayout.split('x')[0]) || 2) : 2}
          gridRows={gridLayout.includes('x') ? (parseInt(gridLayout.split('x')[1]) || 2) : 2}
          layoutChangedAt={layoutChangedAt}
          gridLayout={gridLayout}
        />
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
