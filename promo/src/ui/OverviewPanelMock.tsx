import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { app, fonts } from '../theme';

/**
 * Simplified SubFrame Overview panel — stats cards, LOC bar chart,
 * git activity heatmap, and commit trend area. Matches the real
 * OverviewPanel / StatsDetailView layout.
 */

// -- Mock data --

const summaryMetrics = [
  { label: 'Lines of Code', value: '47,832', icon: '</>', color: '#a855f7' },
  { label: 'Source Files', value: '186', icon: '{}', color: '#78a5d4' },
  { label: 'Commits', value: '1,247', icon: 'Y', color: '#7cb382' },
  { label: 'Branch', value: 'main', icon: '^', color: app.accent },
];

const locByExtension = [
  { ext: '.tsx', count: 18420, color: '#a855f7' },
  { ext: '.ts', count: 14380, color: '#78a5d4' },
  { ext: '.css', count: 6210, color: '#e040a0' },
  { ext: '.json', count: 4890, color: app.accent },
  { ext: '.md', count: 2640, color: '#7cb382' },
  { ext: '.js', count: 1292, color: '#e0a458' },
];

const maxLoc = locByExtension[0].count;

// Simplified heatmap — 12 weeks x 7 days
const heatmapWeeks = 16;
const heatmapDays = 7;

function getHeatmapIntensity(week: number, day: number): number {
  // Deterministic pseudo-random based on position
  const seed = (week * 7 + day) * 2654435761;
  const v = ((seed >>> 0) % 100) / 100;
  if (v < 0.3) return 0;
  if (v < 0.55) return 1;
  if (v < 0.75) return 2;
  if (v < 0.9) return 3;
  return 4;
}

const heatmapColors = [
  app.bgHover,
  'rgba(212, 165, 116, 0.2)',
  'rgba(212, 165, 116, 0.4)',
  'rgba(212, 165, 116, 0.6)',
  app.accent,
];

// Commit trend data (12 data points)
const trendData = [12, 18, 8, 24, 31, 22, 15, 28, 35, 19, 26, 42];
const trendMax = Math.max(...trendData);

// Task progress
const tasksDone = 14;
const tasksTotal = 29;

export const OverviewPanelMock: React.FC<{
  width?: number;
  animateIn?: boolean;
}> = ({ width = 360, animateIn = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = animateIn
    ? spring({ frame, fps, config: { damping: 14, stiffness: 80 } })
    : 1;
  const panelOpacity = interpolate(enterProgress, [0, 1], [0, 1]);
  const panelX = interpolate(enterProgress, [0, 1], [20, 0]);

  // Stagger helper for cards
  const cardProgress = (delay: number) =>
    animateIn
      ? spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 100 } })
      : 1;

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
        <span style={{ fontSize: 13, fontWeight: 600, color: app.textPrimary }}>
          Project Overview
        </span>
        <div
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            fontSize: 12,
            color: app.textTertiary,
          }}
        >
          ↻
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '8px 14px' }}>
        {/* Summary metrics — 2x2 grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 12,
            opacity: interpolate(cardProgress(5), [0, 1], [0, 1]),
          }}
        >
          {summaryMetrics.map((m) => (
            <div
              key={m.label}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: app.bgDeep,
                border: `1px solid ${app.border}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 10,
                    color: m.color,
                    fontWeight: 700,
                  }}
                >
                  {m.icon}
                </span>
                <span style={{ fontSize: 10, color: app.textTertiary }}>
                  {m.label}
                </span>
              </div>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: app.textPrimary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {m.value}
              </span>
            </div>
          ))}
        </div>

        {/* Task progress bar */}
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: app.bgDeep,
            border: `1px solid ${app.border}`,
            marginBottom: 12,
            opacity: interpolate(cardProgress(12), [0, 1], [0, 1]),
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 11, color: app.textSecondary }}>
              Progress
            </span>
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 10,
                color: app.textTertiary,
              }}
            >
              {tasksDone}/{tasksTotal} tasks
            </span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: app.bgTertiary,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${interpolate(cardProgress(15), [0, 1], [0, (tasksDone / tasksTotal) * 100])}%`,
                height: '100%',
                borderRadius: 3,
                background: app.accent,
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 5,
              fontSize: 10,
            }}
          >
            <span style={{ color: app.success }}>14 done</span>
            <span style={{ color: app.accent }}>3 active</span>
            <span style={{ color: app.textTertiary }}>12 pending</span>
          </div>
        </div>

        {/* LOC by Extension */}
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: app.bgDeep,
            border: `1px solid ${app.border}`,
            marginBottom: 12,
            opacity: interpolate(cardProgress(18), [0, 1], [0, 1]),
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: app.textSecondary,
              display: 'block',
              marginBottom: 8,
            }}
          >
            Lines of Code by Extension
          </span>
          {locByExtension.map((item, i) => {
            const barProgress = animateIn
              ? interpolate(
                  spring({
                    frame: frame - (22 + i * 4),
                    fps,
                    config: { damping: 18, stiffness: 80 },
                  }),
                  [0, 1],
                  [0, item.count / maxLoc]
                )
              : item.count / maxLoc;

            return (
              <div
                key={item.ext}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 10,
                    color: app.textTertiary,
                    width: 36,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {item.ext}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    background: app.bgTertiary,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${barProgress * 100}%`,
                      height: '100%',
                      borderRadius: 4,
                      background: item.color,
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 9,
                    color: app.textMuted,
                    width: 40,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}
                >
                  {item.count.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Git Activity Heatmap */}
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: app.bgDeep,
            border: `1px solid ${app.border}`,
            marginBottom: 12,
            opacity: interpolate(cardProgress(30), [0, 1], [0, 1]),
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: app.textSecondary,
              display: 'block',
              marginBottom: 6,
            }}
          >
            Git Activity
          </span>
          <div
            style={{
              display: 'flex',
              gap: 2,
            }}
          >
            {Array.from({ length: heatmapWeeks }).map((_, w) => (
              <div
                key={w}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {Array.from({ length: heatmapDays }).map((_, d) => {
                  const intensity = getHeatmapIntensity(w, d);
                  // Stagger the heatmap cells appearing
                  const cellDelay = 32 + w * 1.5;
                  const cellProgress = animateIn
                    ? spring({
                        frame: frame - cellDelay,
                        fps,
                        config: { damping: 20, stiffness: 120 },
                      })
                    : 1;

                  return (
                    <div
                      key={d}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: heatmapColors[intensity],
                        opacity: interpolate(cellProgress, [0, 1], [0, 1]),
                        transform: `scale(${interpolate(cellProgress, [0, 1], [0.5, 1])})`,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              marginTop: 5,
              justifyContent: 'flex-end',
            }}
          >
            <span style={{ fontSize: 9, color: app.textMuted, marginRight: 2 }}>
              Less
            </span>
            {heatmapColors.map((c, i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: c,
                }}
              />
            ))}
            <span style={{ fontSize: 9, color: app.textMuted, marginLeft: 2 }}>
              More
            </span>
          </div>
        </div>

        {/* Commit Trend (mini area chart) */}
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: app.bgDeep,
            border: `1px solid ${app.border}`,
            opacity: interpolate(cardProgress(38), [0, 1], [0, 1]),
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 11, color: app.textSecondary }}>
              Commit Trend
            </span>
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 10,
                color: app.textMuted,
                padding: '1px 6px',
                background: app.bgTertiary,
                borderRadius: 4,
              }}
            >
              90d
            </span>
          </div>
          {/* SVG area chart */}
          <svg
            viewBox="0 0 300 60"
            style={{ width: '100%', height: 60 }}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={app.accent} stopOpacity="0.35" />
                <stop offset="100%" stopColor={app.accent} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {/* Grid lines */}
            {[15, 30, 45].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="300"
                y2={y}
                stroke={app.border}
                strokeDasharray="4 4"
              />
            ))}
            {/* Area fill */}
            <path
              d={(() => {
                const chartProgress = animateIn
                  ? interpolate(
                      spring({
                        frame: frame - 40,
                        fps,
                        config: { damping: 14, stiffness: 60 },
                      }),
                      [0, 1],
                      [0, 1]
                    )
                  : 1;

                const points = trendData.map((v, i) => {
                  const x = (i / (trendData.length - 1)) * 300;
                  const rawY = 55 - (v / trendMax) * 50;
                  const y = 55 - (55 - rawY) * chartProgress;
                  return `${x},${y}`;
                });
                return `M0,55 L${points.join(' L')} L300,55 Z`;
              })()}
              fill="url(#trendFill)"
            />
            {/* Line */}
            <path
              d={(() => {
                const chartProgress = animateIn
                  ? interpolate(
                      spring({
                        frame: frame - 40,
                        fps,
                        config: { damping: 14, stiffness: 60 },
                      }),
                      [0, 1],
                      [0, 1]
                    )
                  : 1;

                const points = trendData.map((v, i) => {
                  const x = (i / (trendData.length - 1)) * 300;
                  const rawY = 55 - (v / trendMax) * 50;
                  const y = 55 - (55 - rawY) * chartProgress;
                  return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                });
                return points.join(' ');
              })()}
              fill="none"
              stroke={app.accent}
              strokeWidth="1.5"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
