/**
 * Terminal name generator — curated codenames for new terminals.
 *
 * Instead of "Terminal 1, 2, 3", terminals get distinctive short names
 * like "spark", "drift", "echo". Names are drawn from a shuffled pool
 * and recycled when all are used. Collisions append a digit: "spark-2".
 */

const CODENAMES = [
  'pulse', 'drift', 'spark', 'forge', 'nexus',
  'flux',  'echo',  'haze',  'ember', 'onyx',
  'void',  'aurora','cipher','helix', 'prism',
  'surge', 'orbit', 'vapor', 'zinc',  'neon',
  'arc',   'dusk',  'flare', 'ghost', 'iris',
  'jade',  'kite',  'lumen', 'mesa',  'nova',
  'opal',  'quark', 'ridge', 'shard', 'tidal',
  'umbra', 'vex',   'warp',  'xenon', 'zephyr',
];

/** Shuffled queue — refilled when exhausted */
let queue: string[] = [];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function refillQueue(): void {
  queue = shuffle(CODENAMES);
}

/**
 * Generate a unique terminal name given the set of currently used names.
 * Draws from a shuffled pool. If the name is already taken, appends -2, -3, etc.
 */
export function generateTerminalName(usedNames: Set<string>): string {
  if (queue.length === 0) refillQueue();

  const base = queue.pop()!;

  if (!usedNames.has(base)) return base;

  // Collision — find next available suffix
  let n = 2;
  while (usedNames.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Get the set of current terminal names from the store.
 * Pass the terminals Map from useTerminalStore.
 */
export function getUsedTerminalNames(terminals: Map<string, { name: string }>): Set<string> {
  const names = new Set<string>();
  for (const [, info] of terminals) {
    names.add(info.name.toLowerCase());
  }
  return names;
}
