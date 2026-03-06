import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { app, fonts } from '../theme';

/**
 * Simplified SubFrame command palette — centered modal overlay.
 * Faithfully recreates the real CommandPalette dialog.
 */

interface Command {
  icon: string;
  label: string;
  shortcut?: string;
  group: string;
}

const commands: Command[] = [
  { icon: '☰', label: 'Sub-Tasks', shortcut: 'Ctrl+Shift+S', group: 'Panels' },
  { icon: '◈', label: 'Agent Activity', shortcut: 'Ctrl+Shift+A', group: 'Panels' },
  { icon: '⬡', label: 'GitHub Issues', shortcut: 'Ctrl+Shift+G', group: 'Panels' },
  { icon: '▣', label: 'Project Overview', group: 'Views' },
  { icon: '◇', label: 'Structure Map', group: 'Views' },
  { icon: '▷', label: 'Start AI Tool', group: 'Terminal' },
  { icon: '+', label: 'New Terminal', shortcut: 'Ctrl+Shift+`', group: 'Terminal' },
  { icon: '⚙', label: 'Open Settings', shortcut: 'Ctrl+,', group: 'Settings' },
];

export const CommandPaletteMock: React.FC<{
  /** Frame offset to start the open animation */
  enterAt?: number;
  /** Which command index to highlight */
  highlightIndex?: number;
}> = ({ enterAt = 0, highlightIndex = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relativeFrame = frame - enterAt;

  // Backdrop fade
  const backdropOpacity = interpolate(
    spring({
      frame: relativeFrame,
      fps,
      config: { damping: 20, stiffness: 120 },
    }),
    [0, 1],
    [0, 0.6]
  );

  // Modal scale + fade
  const modalProgress = spring({
    frame: relativeFrame,
    fps,
    config: { damping: 16, stiffness: 100 },
  });
  const modalOpacity = interpolate(modalProgress, [0, 1], [0, 1]);
  const modalScale = interpolate(modalProgress, [0, 1], [0.95, 1]);
  const modalY = interpolate(modalProgress, [0, 1], [-10, 0]);

  // Highlight steps through items one at a time toward the target
  // Each step takes ~12 frames for a natural browsing feel
  const stepsToTarget = highlightIndex;
  let currentHighlight = 0;
  if (relativeFrame >= 14) {
    const stepsElapsed = Math.floor((relativeFrame - 14) / 12);
    currentHighlight = Math.min(stepsElapsed, stepsToTarget);
  }

  // Group tracking
  let lastGroup = '';

  if (relativeFrame < 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 120,
        zIndex: 100,
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'black',
          opacity: backdropOpacity,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          width: 480,
          background: app.bgPrimary,
          border: `1px solid ${app.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          opacity: modalOpacity,
          transform: `scale(${modalScale}) translateY(${modalY}px)`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          fontFamily: fonts.display,
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: `1px solid ${app.border}`,
          }}
        >
          <span style={{ fontSize: 14, color: app.textMuted }}>⌕</span>
          <span style={{ fontSize: 14, color: app.textMuted }}>
            Type a command...
          </span>
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 10,
              color: app.textMuted,
              padding: '2px 6px',
              background: app.bgElevated,
              borderRadius: 4,
              border: `1px solid ${app.border}`,
            }}
          >
            Ctrl /
          </span>
        </div>

        {/* Command list */}
        <div style={{ padding: '4px 0', maxHeight: 320 }}>
          {commands.map((cmd, i) => {
            const showGroup = cmd.group !== lastGroup;
            lastGroup = cmd.group;

            const isHighlighted = i === currentHighlight;

            return (
              <div key={i}>
                {/* Group heading */}
                {showGroup && (
                  <div
                    style={{
                      padding: '8px 16px 4px',
                      fontSize: 11,
                      fontWeight: 500,
                      color: app.textMuted,
                      letterSpacing: '0.03em',
                    }}
                  >
                    {cmd.group}
                  </div>
                )}

                {/* Command item */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 16px',
                    background: isHighlighted ? app.bgHover : 'transparent',
                    borderLeft: isHighlighted
                      ? `2px solid ${app.accent}`
                      : '2px solid transparent',
                    cursor: 'default',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: isHighlighted
                        ? app.textPrimary
                        : app.textTertiary,
                      width: 18,
                      textAlign: 'center',
                    }}
                  >
                    {cmd.icon}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: isHighlighted
                        ? app.textPrimary
                        : app.textSecondary,
                    }}
                  >
                    {cmd.label}
                  </span>
                  {cmd.shortcut && (
                    <span
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 10,
                        color: app.textMuted,
                      }}
                    >
                      {cmd.shortcut}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
