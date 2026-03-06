import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { app, colors, fonts, gradientText } from '../theme';
import { AtomLogo } from '../AtomLogo';
import { SidebarMock } from '../ui/SidebarMock';
import { TerminalMock } from '../ui/TerminalMock';
import { TasksPanelMock } from '../ui/TasksPanelMock';
import { CommandPaletteMock } from '../ui/CommandPaletteMock';
import { OverviewPanelMock } from '../ui/OverviewPanelMock';
import { AIToolSelectorMock } from '../ui/AIToolSelectorMock';
import { CursorMock } from '../ui/CursorMock';

/**
 * Scene: App Demo (15 seconds = 450 frames @ 30fps)
 *
 * Timeline:
 *   0-55:    "Meet SubFrame" intro overlay (logo + text)
 *   35-65:   Window chrome fades in (overlaps with intro fadeout)
 *   40-90:   Sidebar slides in from left
 *   55-120:  Terminal appears with single pane + typewriter output
 *   90-140:  Tasks panel slides in from right
 *   150:     Terminal switches to 2x2 grid (all 4 panes typing simultaneously)
 *   195-255: AI Tool Selector overlay (browse tools, select Claude Code)
 *   265-330: Command palette opens, highlight steps to "Project Overview"
 *   330:     Palette closes → Overview panel cross-fades in (tab bar updates)
 *   340-350: Cursor appears, moves to grid layout dropdown button
 *   352:     Cursor clicks dropdown — layout menu opens
 *   364:     Cursor selects 3×3 — grid changes to 9 panes
 *   375-385: Cursor moves to sidebar workspace selector
 *   388:     Cursor clicks — workspace switch (Default → Work)
 *   415:     Cursor clicks back — workspace switches back (Work → Default)
 *   330-435: Overview panel with animated charts + stats
 *   435+:    Hold
 */

export const AppDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ─── Intro overlay ("Meet SubFrame") ────────────────────────────────────────

  const introLogoProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80 },
  });
  const introLogoScale = interpolate(introLogoProgress, [0, 1], [0.6, 1]);
  const introLogoOpacity = interpolate(introLogoProgress, [0, 1], [0, 1]);

  const introTextProgress = spring({
    frame: frame - 8,
    fps,
    config: { damping: 14, stiffness: 100 },
  });
  const introTextOpacity = interpolate(introTextProgress, [0, 1], [0, 1]);
  const introTextY = interpolate(introTextProgress, [0, 1], [15, 0]);

  // Entire intro fades out — stays longer before dissolving
  const introFadeOut = interpolate(frame, [95, 120], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const showIntro = frame < 120;

  // ─── App chrome animations (starts sooner, fades in behind intro) ─────────

  const chromeProgress = spring({
    frame: frame - 25,
    fps,
    config: { damping: 16, stiffness: 80 },
  });
  const chromeOpacity = interpolate(chromeProgress, [0, 1], [0, 1]);
  const chromeScale = interpolate(chromeProgress, [0, 1], [0.96, 1]);

  // Sidebar width animation
  const sidebarProgress = spring({
    frame: frame - 40,
    fps,
    config: { damping: 14, stiffness: 60 },
  });
  const sidebarWidth = interpolate(sidebarProgress, [0, 1], [0, 250]);

  // Right panel slide timing
  const rightPanelProgress = spring({
    frame: frame - 90,
    fps,
    config: { damping: 14, stiffness: 60 },
  });
  const rightPanelWidth = interpolate(rightPanelProgress, [0, 1], [0, 360]);

  // Terminal area opacity
  const terminalProgress = spring({
    frame: frame - 55,
    fps,
    config: { damping: 14, stiffness: 80 },
  });
  const terminalOpacity = interpolate(terminalProgress, [0, 1], [0, 1]);

  // AI Tool Selector timing — 60 frames for slower step-through
  const showToolSelector = frame >= 195 && frame < 255;

  // Command palette timing — 65 frames, highlight reaches index 3 at ~50 frames in
  const showPalette = frame >= 265 && frame < 330;

  // Overview panel transition — starts immediately when palette closes
  const showOverview = frame >= 330;

  // Cross-fade between Tasks and Overview panels
  const overviewTransition = spring({
    frame: frame - 330,
    fps,
    config: { damping: 16, stiffness: 80 },
  });

  // Which panel toggle is active in the tab bar (0=Tasks, 2=Overview)
  const activePanelIndex = showOverview ? 2 : 0;

  // Grid layout — cursor clicks dropdown at ~356, hovers 3×3 at ~372, selects at ~378
  const gridLayout = frame >= 378 ? '3x3' : '2x2';
  const showGridDropdown = frame >= 358 && frame < 380;
  const gridDropdownHighlight = frame >= 370 && frame < 380 ? '3x3' : undefined;
  const layoutChangedAt = 378;

  // Workspace switching — cursor clicks at ~442, switch happens at 444, back at 484
  const activeProjectIndex =
    frame >= 444 && frame < 484 ? 1 : 0;

  // Title bar text follows active workspace's first project
  const titleBarProject = activeProjectIndex === 1
    ? 'SubFrame — api-server'
    : 'SubFrame — SubFrame';

  // ─── Bottom labels ──────────────────────────────────────────────────────────

  // "Terminal Grid" label when grid appears
  const showLabel2 = frame >= 145 && frame < 190;
  const label2Opacity = showLabel2
    ? interpolate(
        spring({
          frame: frame - 145,
          fps,
          config: { damping: 14, stiffness: 100 },
        }),
        [0, 1],
        [0, 1]
      ) * interpolate(frame, [185, 192], [1, 0], { extrapolateRight: 'clamp' })
    : 0;

  // "AI Tool Selector" label
  const showLabel3 = frame >= 197 && frame < 252;
  const label3Opacity = showLabel3
    ? interpolate(
        spring({
          frame: frame - 197,
          fps,
          config: { damping: 14, stiffness: 100 },
        }),
        [0, 1],
        [0, 1]
      ) * interpolate(frame, [247, 254], [1, 0], { extrapolateRight: 'clamp' })
    : 0;

  // "Command Palette" label
  const showLabel3b = frame >= 268 && frame < 327;
  const label3bOpacity = showLabel3b
    ? interpolate(
        spring({
          frame: frame - 268,
          fps,
          config: { damping: 14, stiffness: 100 },
        }),
        [0, 1],
        [0, 1]
      ) * interpolate(frame, [322, 329], [1, 0], { extrapolateRight: 'clamp' })
    : 0;

  // "Project Overview" label when overview appears (ends before grid dropdown)
  const showLabel4 = frame >= 335 && frame < 350;
  const label4Opacity = showLabel4
    ? interpolate(
        spring({
          frame: frame - 335,
          fps,
          config: { damping: 14, stiffness: 100 },
        }),
        [0, 1],
        [0, 1]
      ) * interpolate(frame, [345, 352], [1, 0], { extrapolateRight: 'clamp' })
    : 0;

  // "Grid Layout" label during grid dropdown + hold on 3×3
  const showLabel5a = frame >= 356 && frame < 435;
  const label5aOpacity = showLabel5a
    ? interpolate(
        spring({
          frame: frame - 356,
          fps,
          config: { damping: 14, stiffness: 100 },
        }),
        [0, 1],
        [0, 1]
      ) * interpolate(frame, [430, 437], [1, 0], { extrapolateRight: 'clamp' })
    : 0;

  // "Multi-Workspace" label during workspace switch
  const showLabel5 = frame >= 442 && frame < 510;
  const label5Opacity = showLabel5
    ? interpolate(
        spring({
          frame: frame - 442,
          fps,
          config: { damping: 14, stiffness: 100 },
        }),
        [0, 1],
        [0, 1]
      ) * interpolate(frame, [505, 512], [1, 0], { extrapolateRight: 'clamp' })
    : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#050506',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          width: 800,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, rgba(212,165,116,0.04) 0%, transparent 70%)`,
          opacity: interpolate(Math.sin(frame / 40), [-1, 1], [0.5, 1]),
        }}
      />

      {/* ── "Meet SubFrame" intro overlay ── */}
      {showIntro && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 20,
            opacity: introFadeOut,
          }}
        >
          <div
            style={{
              transform: `scale(${introLogoScale})`,
              opacity: introLogoOpacity,
              marginBottom: 20,
            }}
          >
            <AtomLogo size={90} />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: introTextOpacity,
              transform: `translateY(${introTextY}px)`,
            }}
          >
            <span
              style={{
                fontFamily: fonts.display,
                fontSize: 28,
                color: colors.textSecondary,
                fontWeight: 400,
              }}
            >
              Meet
            </span>
            <span
              style={{
                ...gradientText(),
                fontFamily: fonts.display,
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              SubFrame
            </span>
          </div>
        </div>
      )}

      {/* ── Window frame ── */}
      <div
        style={{
          width: 1760,
          height: 960,
          borderRadius: 12,
          overflow: 'hidden',
          border: `1px solid ${app.borderDefault}`,
          boxShadow: '0 20px 80px rgba(0, 0, 0, 0.6)',
          opacity: chromeOpacity,
          transform: `scale(${chromeScale})`,
          display: 'flex',
          flexDirection: 'column',
          background: app.bgDeep,
          position: 'relative',
        }}
      >
        {/* macOS-style title bar */}
        <div
          style={{
            height: 38,
            background: app.bgSecondary,
            borderBottom: `1px solid ${app.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            gap: 8,
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 12,
              color: app.textTertiary,
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            {titleBarProject}
          </span>
        </div>

        {/* App body — flex row */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div
            style={{
              width: sidebarWidth,
              height: '100%',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <SidebarMock
              width={250}
              animateIn={false}
              showActivity
              activeProjectIndex={activeProjectIndex}
            />
          </div>

          {/* Terminal area */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              opacity: terminalOpacity,
            }}
          >
            <TerminalMock
              animateIn={false}
              showTabBar
              showUsage
              gridAt={150}
              activePanelIndex={activePanelIndex}
              workspaceIndex={activeProjectIndex}
              gridLayout={gridLayout}
              showGridDropdown={showGridDropdown}
              gridDropdownHighlight={gridDropdownHighlight}
              layoutChangedAt={layoutChangedAt}
            />
          </div>

          {/* Right panel — Tasks or Overview */}
          <div
            style={{
              width: rightPanelWidth,
              height: '100%',
              overflow: 'hidden',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {/* Tasks panel — fades out when Overview takes over */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: showOverview
                  ? interpolate(overviewTransition, [0, 1], [1, 0])
                  : 1,
                pointerEvents: showOverview ? 'none' : 'auto',
              }}
            >
              <TasksPanelMock width={360} animateIn={false} />
            </div>

            {/* Overview panel — fades in */}
            {showOverview && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: interpolate(overviewTransition, [0, 1], [0, 1]),
                }}
              >
                <OverviewPanelMock width={360} animateIn />
              </div>
            )}
          </div>
        </div>

        {/* AI Tool Selector overlay */}
        {showToolSelector && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              top: 38,
              zIndex: 50,
            }}
          >
            <AIToolSelectorMock enterAt={195} />
          </div>
        )}

        {/* Command Palette overlay */}
        {showPalette && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              top: 38,
              zIndex: 50,
            }}
          >
            <CommandPaletteMock enterAt={265} highlightIndex={3} />
          </div>
        )}

        {/* Cursor — grid dropdown then workspace switch */}
        <CursorMock
          enterAt={340}
          exitAt={515}
          waypoints={[
            // Start from center of terminal area
            { frame: 340, x: 700, y: 400 },
            // Move to grid layout dropdown button in tab bar
            { frame: 354, x: 1136, y: 56, click: true },
            // Hold while dropdown opens
            { frame: 362, x: 1136, y: 56 },
            // Move down through dropdown to "3×3" option (5th item)
            { frame: 372, x: 1136, y: 170 },
            // Click 3×3
            { frame: 376, x: 1136, y: 170, click: true },
            // Grid changes — pause to let viewer see 3×3
            { frame: 395, x: 700, y: 400 },
            // Move to sidebar workspace selector
            { frame: 440, x: 80, y: 150, click: true },
            // Workspace switches — hold to see Work workspace
            { frame: 468, x: 80, y: 150 },
            // Click back to Default
            { frame: 480, x: 80, y: 150, click: true },
            // Workspace switches back — drift away
            { frame: 510, x: 400, y: 350 },
          ]}
        />
      </div>

      {/* ── Bottom labels ── */}
      {label2Opacity > 0.01 && (
        <div style={{ position: 'absolute', bottom: 56, opacity: label2Opacity }}>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 14,
              color: app.accent,
              padding: '6px 16px',
              background: app.bgSecondary,
              borderRadius: 8,
              border: `1px solid rgba(212, 165, 116, 0.2)`,
            }}
          >
            Terminal Grid — 4 panes, simultaneous output
          </span>
        </div>
      )}
      {label3Opacity > 0.01 && (
        <div style={{ position: 'absolute', bottom: 56, opacity: label3Opacity }}>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 14,
              color: app.success,
              padding: '6px 16px',
              background: app.bgSecondary,
              borderRadius: 8,
              border: `1px solid rgba(124, 179, 130, 0.2)`,
            }}
          >
            AI Tool Selector — Claude, Codex, Gemini
          </span>
        </div>
      )}
      {label3bOpacity > 0.01 && (
        <div style={{ position: 'absolute', bottom: 56, opacity: label3bOpacity }}>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 14,
              color: app.accent,
              padding: '6px 16px',
              background: app.bgSecondary,
              borderRadius: 8,
              border: `1px solid rgba(212, 165, 116, 0.2)`,
            }}
          >
            Command Palette — quick navigation
          </span>
        </div>
      )}
      {label4Opacity > 0.01 && (
        <div style={{ position: 'absolute', bottom: 56, opacity: label4Opacity }}>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 14,
              color: app.info,
              padding: '6px 16px',
              background: app.bgSecondary,
              borderRadius: 8,
              border: `1px solid rgba(120, 165, 212, 0.2)`,
            }}
          >
            Project Overview — stats, charts, git activity
          </span>
        </div>
      )}
      {label5aOpacity > 0.01 && (
        <div style={{ position: 'absolute', bottom: 56, opacity: label5aOpacity }}>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 14,
              color: app.accent,
              padding: '6px 16px',
              background: app.bgSecondary,
              borderRadius: 8,
              border: `1px solid rgba(212, 165, 116, 0.2)`,
            }}
          >
            Grid Layout — 1×2 up to 3×3
          </span>
        </div>
      )}
      {label5Opacity > 0.01 && (
        <div style={{ position: 'absolute', bottom: 56, opacity: label5Opacity }}>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 14,
              color: app.accent,
              padding: '6px 16px',
              background: app.bgSecondary,
              borderRadius: 8,
              border: `1px solid rgba(212, 165, 116, 0.2)`,
            }}
          >
            Multi-Workspace — switch projects instantly
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
