import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { app } from '../theme';

/**
 * Animated macOS-style cursor that moves between waypoints.
 * Each waypoint has a position and a frame time.
 * The cursor interpolates smoothly between them and can "click" (scale bounce).
 */

export interface CursorWaypoint {
  /** Absolute frame when the cursor should be at this position */
  frame: number;
  /** X position (absolute within parent) */
  x: number;
  /** Y position */
  y: number;
  /** If true, plays a click bounce at this waypoint */
  click?: boolean;
}

export const CursorMock: React.FC<{
  waypoints: CursorWaypoint[];
  /** Frame at which cursor fades in */
  enterAt: number;
  /** Frame at which cursor fades out */
  exitAt: number;
}> = ({ waypoints, enterAt, exitAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (waypoints.length === 0) return null;

  // Fade in/out
  const fadeIn = spring({
    frame: frame - enterAt,
    fps,
    config: { damping: 16, stiffness: 120 },
  });
  const fadeOut = interpolate(frame, [exitAt, exitAt + 10], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(interpolate(fadeIn, [0, 1], [0, 1]), fadeOut);

  if (opacity < 0.01) return null;

  // Find current position by interpolating between waypoints
  let x = waypoints[0].x;
  let y = waypoints[0].y;
  let clickBounce = 0;

  if (frame <= waypoints[0].frame) {
    x = waypoints[0].x;
    y = waypoints[0].y;
  } else if (frame >= waypoints[waypoints.length - 1].frame) {
    x = waypoints[waypoints.length - 1].x;
    y = waypoints[waypoints.length - 1].y;
  } else {
    // Find the two waypoints we're between
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      if (frame >= a.frame && frame <= b.frame) {
        const t = (frame - a.frame) / (b.frame - a.frame);
        // Ease-in-out cubic
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        x = a.x + (b.x - a.x) * ease;
        y = a.y + (b.y - a.y) * ease;
        break;
      }
    }
  }

  // Check for click bounce at any waypoint
  for (const wp of waypoints) {
    if (wp.click) {
      const clickRel = frame - wp.frame;
      if (clickRel >= 0 && clickRel < 8) {
        clickBounce = Math.sin((clickRel / 8) * Math.PI) * 0.15;
      }
    }
  }

  const scale = 1 - clickBounce;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 0,
        height: 0,
        opacity,
        transform: `scale(${scale})`,
        zIndex: 200,
        pointerEvents: 'none',
      }}
    >
      {/* macOS arrow cursor */}
      <svg
        width="24"
        height="28"
        viewBox="0 0 24 28"
        style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
      >
        <path
          d="M5 1 L5 21 L10 16 L15 24 L18 22 L13 14 L20 14 Z"
          fill="white"
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={1}
        />
      </svg>
      {/* Click ripple */}
      {clickBounce > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 3,
            top: 3,
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: `2px solid ${app.accent}`,
            opacity: clickBounce * 4,
            transform: `scale(${1 + clickBounce * 6})`,
          }}
        />
      )}
    </div>
  );
};
