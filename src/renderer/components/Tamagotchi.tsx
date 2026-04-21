/**
 * Tamagotchi — cosmetic animated mascot overlay.
 *
 * A draggable SVG creature that sits on top of the SubFrame UI and reacts
 * to agent activity with mood changes. Pure renderer-side, no IPC.
 *
 * Moods (precedence: working > error > happy > hungry > idle):
 *  - working: bobbing, alert — any active/busy agent session
 *  - error:   shaking, concerned — terminal stall detected
 *  - happy:   bouncy, hearts — recent task completion or just fed
 *  - hungry:  drooping — hasn't been clicked in 5 minutes
 *  - idle:    slow breathing — nothing going on
 *
 * Click to feed (resets hunger, briefly shows happy).
 * Drag to reposition (position persisted to localStorage via useUIStore).
 * Ctrl/Cmd+Shift+T to toggle visibility.
 */

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useUIStore } from '../stores/useUIStore';
import { useAgentState } from '../hooks/useAgentState';
import { useTasks } from '../hooks/useTasks';
import { useIPCEvent } from '../hooks/useIPCListener';

type Mood = 'idle' | 'working' | 'happy' | 'error' | 'hungry';

const HUNGER_MS = 5 * 60 * 1000; // 5 minutes
const HAPPY_DURATION_MS = 2000;  // click-feed happy duration
const COMPLETION_HAPPY_MS = 5000; // task-completion happy duration
const ERROR_DURATION_MS = 3000;  // stall-triggered error duration

// ─── Mood computation ────────────────────────────────────────────────────────

function computeMood(args: {
  hasActiveAgent: boolean;
  errorActive: boolean;
  happyActive: boolean;
  isHungry: boolean;
}): Mood {
  if (args.hasActiveAgent) return 'working';
  if (args.errorActive) return 'error';
  if (args.happyActive) return 'happy';
  if (args.isHungry) return 'hungry';
  return 'idle';
}

// ─── Sprite (single SVG with per-mood eye/mouth tweaks) ──────────────────────

interface SpriteProps {
  mood: Mood;
}

function Sprite({ mood }: SpriteProps) {
  // Eye shapes: idle is sleepy (line), hungry droops, working/error/happy are round
  const leftEye = mood === 'idle' || mood === 'hungry'
    ? <path d="M14 22 Q17 24 20 22" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    : <circle cx="17" cy="22" r="2" fill="currentColor" />;
  const rightEye = mood === 'idle' || mood === 'hungry'
    ? <path d="M28 22 Q31 24 34 22" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    : <circle cx="31" cy="22" r="2" fill="currentColor" />;

  // Mouth varies by mood
  let mouth: ReactElement;
  if (mood === 'happy') {
    mouth = <path d="M18 30 Q24 34 30 30" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
  } else if (mood === 'working') {
    mouth = <circle cx="24" cy="31" r="1.5" fill="currentColor" />;
  } else if (mood === 'error') {
    mouth = <path d="M19 32 Q24 28 29 32" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
  } else if (mood === 'hungry') {
    mouth = <path d="M20 31 Q24 29 28 31" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
  } else {
    // idle
    mouth = <path d="M20 30 L28 30" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
  }

  // Side decoration: hearts for happy, question mark for error
  const decoration = mood === 'happy' ? (
    <g>
      <path d="M40 10 l-1.5 -1.5 a1 1 0 0 0 -1.5 1.3 l3 3 l3 -3 a1 1 0 0 0 -1.5 -1.3 z" fill="#ff6b9d" />
    </g>
  ) : mood === 'error' ? (
    <g>
      <text x="40" y="12" fontSize="9" fill="#ffb347" fontWeight="700" fontFamily="sans-serif">?</text>
    </g>
  ) : null;

  return (
    <svg
      viewBox="0 0 48 48"
      width="100%"
      height="100%"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Little ears */}
      <circle cx="13" cy="12" r="4" fill="currentColor" opacity="0.85" />
      <circle cx="35" cy="12" r="4" fill="currentColor" opacity="0.85" />
      <circle cx="13" cy="12" r="1.8" fill="#ffb3c6" opacity="0.9" />
      <circle cx="35" cy="12" r="1.8" fill="#ffb3c6" opacity="0.9" />
      {/* Body */}
      <circle cx="24" cy="26" r="15" fill="currentColor" opacity="0.95" />
      {/* Tummy highlight */}
      <ellipse cx="24" cy="30" rx="9" ry="7" fill="#ffe8d6" opacity="0.35" />
      {/* Eye whites */}
      <circle cx="17" cy="22" r="3" fill="#fff9f0" />
      <circle cx="31" cy="22" r="3" fill="#fff9f0" />
      {/* Eye pupils / shapes */}
      <g style={{ color: '#2a1f14' }}>
        {leftEye}
        {rightEye}
      </g>
      {/* Mouth */}
      <g style={{ color: '#2a1f14' }}>{mouth}</g>
      {/* Blush when happy */}
      {mood === 'happy' && (
        <>
          <circle cx="14" cy="28" r="1.8" fill="#ff9aa2" opacity="0.7" />
          <circle cx="34" cy="28" r="1.8" fill="#ff9aa2" opacity="0.7" />
        </>
      )}
      {decoration}
    </svg>
  );
}

// ─── Animation variants per mood ─────────────────────────────────────────────

const moodVariants: Record<Mood, Variants> = {
  idle: {
    animate: {
      opacity: [0.4, 0.6, 0.4],
      y: 0,
      scale: 1,
      rotate: 0,
      x: 0,
      transition: { opacity: { duration: 3, repeat: Infinity, ease: 'easeInOut' } },
    },
  },
  working: {
    animate: {
      y: [0, -4, 0],
      opacity: 1,
      scale: 1,
      rotate: 0,
      x: 0,
      transition: { y: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' } },
    },
  },
  happy: {
    animate: {
      scale: [1, 1.15, 1],
      opacity: 1,
      y: 0,
      rotate: 0,
      x: 0,
      transition: { scale: { duration: 0.4, repeat: 3, ease: 'easeInOut' } },
    },
  },
  error: {
    animate: {
      x: [-2, 2, -2, 2, 0],
      opacity: 1,
      y: 0,
      scale: 1,
      rotate: 0,
      transition: { x: { duration: 0.3, ease: 'easeInOut' } },
    },
  },
  hungry: {
    animate: {
      rotate: [0, 3, 0],
      opacity: 0.75,
      y: 0,
      scale: 1,
      x: 0,
      transition: { rotate: { duration: 2, repeat: Infinity, ease: 'easeInOut' } },
    },
  },
};

const MOOD_LABELS: Record<Mood, string> = {
  idle: 'Sleepy',
  working: 'Working',
  happy: 'Happy!',
  error: 'Concerned',
  hungry: 'Hungry',
};

// ─── Main component ──────────────────────────────────────────────────────────

export function Tamagotchi() {
  const position = useUIStore((s) => s.tamagotchiPosition);
  const setPosition = useUIStore((s) => s.setTamagotchiPosition);
  const lastFed = useUIStore((s) => s.tamagotchiLastFed);
  const feed = useUIStore((s) => s.feedTamagotchi);
  const toggleTamagotchi = useUIStore((s) => s.toggleTamagotchi);

  const { sessions } = useAgentState();
  const { grouped } = useTasks();

  // Hunger timer: re-evaluate every 30s
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Transient mood overrides (expire after a duration)
  const [happyUntil, setHappyUntil] = useState(0);
  const [errorUntil, setErrorUntil] = useState(0);

  // Task completion detection — when completed count rises, show happy
  const prevCompletedRef = useRef<number | null>(null);
  const completedCount = grouped?.completed?.length ?? 0;
  useEffect(() => {
    const prev = prevCompletedRef.current;
    if (prev !== null && completedCount > prev) {
      setHappyUntil(Date.now() + COMPLETION_HAPPY_MS);
    }
    prevCompletedRef.current = completedCount;
  }, [completedCount]);

  // Terminal stall detected → error mood
  useIPCEvent<unknown>('terminal-stall-detected', () => {
    setErrorUntil(Date.now() + ERROR_DURATION_MS);
  });

  // Active agent session?
  const hasActiveAgent = useMemo(
    () => sessions.some((s) => s.status === 'active' || s.status === 'busy'),
    [sessions],
  );

  const mood: Mood = useMemo(() => computeMood({
    hasActiveAgent,
    errorActive: now < errorUntil,
    happyActive: now < happyUntil,
    isHungry: now - lastFed > HUNGER_MS,
  }), [hasActiveAgent, errorUntil, happyUntil, now, lastFed]);

  // Force re-render on timer expiry — track the nearest upcoming expiry
  useEffect(() => {
    const deadlines = [happyUntil, errorUntil].filter((t) => t > now);
    if (deadlines.length === 0) return;
    const soonest = Math.min(...deadlines);
    const delay = Math.max(0, soonest - Date.now()) + 50;
    const id = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(id);
  }, [happyUntil, errorUntil, now]);

  // Tooltip hover state
  const [hovered, setHovered] = useState(false);

  // Keyboard shortcut: Ctrl/Cmd+Shift+T to toggle visibility
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const modifier = e.ctrlKey || e.metaKey;
      if (modifier && e.shiftKey && (e.key === 'T' || e.key === 't')) {
        e.preventDefault();
        toggleTamagotchi();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleTamagotchi]);

  // Drag constraints to viewport
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Translate persisted offset (from bottom-right) into CSS bottom/right positioning.
  // The motion.div itself handles drag internally via framer-motion and fires
  // onDragEnd with a delta — we recompute the offset from the reported client rect.
  const [dragging, setDragging] = useState(false);

  // Color palette by mood (applies via currentColor)
  const moodColors: Record<Mood, string> = {
    idle:    '#d4a574',
    working: '#e8b96a',
    happy:   '#f5c98a',
    error:   '#d48a6a',
    hungry:  '#b89668',
  };

  return (
    <div
      ref={constraintsRef}
      className="fixed inset-0 pointer-events-none z-[9998]"
      aria-hidden="false"
    >
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0}
        dragSnapToOrigin
        dragConstraints={constraintsRef}
        onDragStart={() => setDragging(true)}
        onDragEnd={(_e, info) => {
          setDragging(false);
          // Convert the final pointer position into an offset from bottom/right
          // (we persist that so the mascot stays anchored when the window resizes).
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const mascotSize = 56;
          const newX = Math.max(0, Math.min(vw - mascotSize, vw - info.point.x - mascotSize / 2));
          const newY = Math.max(0, Math.min(vh - mascotSize, vh - info.point.y - mascotSize / 2));
          setPosition({ x: newX, y: newY });
        }}
        onClick={() => {
          if (dragging) return;
          feed();
          setHappyUntil(Date.now() + HAPPY_DURATION_MS);
        }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        style={{
          position: 'absolute',
          right: position.x,
          bottom: position.y,
          width: 56,
          height: 56,
          pointerEvents: 'auto',
          cursor: dragging ? 'grabbing' : 'grab',
          color: moodColors[mood],
          filter: hovered ? 'drop-shadow(0 0 6px rgba(212, 165, 116, 0.6))' : 'none',
          willChange: 'transform',
        }}
        variants={moodVariants[mood]}
        animate="animate"
        initial={false}
        whileHover={{ opacity: 1 }}
        whileTap={{ scale: 0.92 }}
        title={`SubFrame buddy — ${MOOD_LABELS[mood]}`}
      >
        <Sprite mood={mood} />

        {/* Tooltip */}
        <AnimatePresence>
          {hovered && !dragging && (
            <motion.div
              key="tooltip"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: 6,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
              className="px-2 py-1 rounded-md bg-bg-elevated border border-border-subtle text-text-primary text-[10px] font-medium shadow-lg"
            >
              {MOOD_LABELS[mood]} — click to feed
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
