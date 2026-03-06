import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { app, fonts } from '../theme';

/**
 * SubFrame AI Tool Selector — modal overlay showing available AI tools.
 * Highlight steps through tools one by one, then settles on Claude Code.
 *
 * Animation timeline (relative frames):
 *   0-8:   Modal springs in, no highlight yet
 *   8:     Highlight appears on Claude Code (0)
 *   16:    Highlight moves to Codex CLI (1)
 *   24:    Highlight moves to Gemini CLI (2)
 *   32:    Highlight moves back to Claude Code (0) — "selected"
 *   36+:   Brief flash, then hold
 */

const tools = [
  {
    name: 'Claude Code',
    integration: 'Native CLAUDE.md',
    color: app.success,
    active: true,
  },
  {
    name: 'Codex CLI',
    integration: 'Wrapper script injection',
    color: app.info,
    active: false,
  },
  {
    name: 'Gemini CLI',
    integration: 'Native GEMINI.md',
    color: app.info,
    active: false,
  },
];

function getHighlightIndex(relFrame: number): number {
  if (relFrame < 12) return -1; // no highlight yet
  if (relFrame < 24) return 0; // Claude Code
  if (relFrame < 36) return 1; // Codex CLI
  if (relFrame < 48) return 2; // Gemini CLI
  return 0; // back to Claude Code — selected
}

export const AIToolSelectorMock: React.FC<{
  enterAt?: number;
}> = ({ enterAt = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relFrame = frame - enterAt;

  // Backdrop fade
  const backdropOpacity = interpolate(
    spring({
      frame: relFrame,
      fps,
      config: { damping: 20, stiffness: 120 },
    }),
    [0, 1],
    [0, 0.5]
  );

  // Modal spring
  const modalProgress = spring({
    frame: relFrame,
    fps,
    config: { damping: 16, stiffness: 100 },
  });
  const modalOpacity = interpolate(modalProgress, [0, 1], [0, 1]);
  const modalScale = interpolate(modalProgress, [0, 1], [0.95, 1]);
  const modalY = interpolate(modalProgress, [0, 1], [-8, 0]);

  const currentHighlight = getHighlightIndex(relFrame);

  // "Selected" flash when returning to Claude Code
  const isSelected = relFrame >= 48;
  const selectedFlash = isSelected
    ? interpolate(
        spring({ frame: relFrame - 48, fps, config: { damping: 12, stiffness: 200 } }),
        [0, 1],
        [0, 1]
      )
    : 0;

  if (relFrame < 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
          width: 380,
          background: app.bgPrimary,
          border: `1px solid ${app.borderDefault}`,
          borderRadius: 12,
          overflow: 'hidden',
          opacity: modalOpacity,
          transform: `scale(${modalScale}) translateY(${modalY}px)`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          fontFamily: fonts.display,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px 8px',
            fontSize: 10,
            fontWeight: 600,
            color: app.textMuted,
            letterSpacing: '0.08em',
          }}
        >
          AI TOOL SELECTOR
        </div>

        {/* Tool list */}
        <div style={{ padding: '0 8px 10px' }}>
          {tools.map((tool, i) => {
            const isHighlighted = i === currentHighlight;
            const isChosenFlash = i === 0 && isSelected;
            const itemProgress = spring({
              frame: relFrame - (i * 5 + 3),
              fps,
              config: { damping: 18, stiffness: 120 },
            });
            const itemOpacity = interpolate(itemProgress, [0, 1], [0, 1]);

            return (
              <div
                key={tool.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: isHighlighted
                    ? isChosenFlash
                      ? `rgba(124, 179, 130, ${0.1 + selectedFlash * 0.1})`
                      : app.accentSubtle
                    : 'transparent',
                  border: isHighlighted
                    ? isChosenFlash
                      ? `1px solid rgba(124, 179, 130, ${0.2 + selectedFlash * 0.15})`
                      : `1px solid rgba(212, 165, 116, 0.2)`
                    : '1px solid transparent',
                  opacity: itemOpacity,
                  marginBottom: 2,
                }}
              >
                {/* Status dot */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: tool.color,
                    flexShrink: 0,
                    boxShadow: isChosenFlash
                      ? `0 0 ${6 + selectedFlash * 4}px ${tool.color}`
                      : tool.active
                        ? `0 0 6px ${tool.color}`
                        : 'none',
                  }}
                />

                {/* Tool name */}
                <span
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: 600,
                    color: app.textPrimary,
                  }}
                >
                  {tool.name}
                </span>

                {/* Integration type */}
                <span
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 10,
                    color: app.textTertiary,
                    padding: '2px 8px',
                    background: app.bgTertiary,
                    borderRadius: 4,
                  }}
                >
                  {tool.integration}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
