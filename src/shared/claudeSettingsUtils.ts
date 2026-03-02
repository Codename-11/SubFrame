/**
 * Claude Settings Utilities
 * Safe read/write/merge of .claude/settings.json for SubFrame hook deployment.
 * SubFrame hooks are identified by the ".subframe/hooks/" prefix in the command field.
 */

import * as fs from 'fs';
import * as path from 'path';

/** A single hook entry in Claude's settings.json */
export interface ClaudeHookEntry {
  type: string;
  command: string;
}

/** A hook matcher group (matcher + array of hooks) */
export interface ClaudeHookMatcher {
  matcher: string;
  hooks: ClaudeHookEntry[];
}

/** The hooks section of .claude/settings.json */
export interface ClaudeHooksConfig {
  [eventType: string]: ClaudeHookMatcher[];
}

/** Full .claude/settings.json shape (partial — we preserve unknown keys) */
export interface ClaudeSettings {
  hooks?: ClaudeHooksConfig;
  [key: string]: unknown;
}

const SUBFRAME_HOOK_PREFIX = '.subframe/hooks/';

/**
 * Read .claude/settings.json safely. Returns empty object if missing/invalid.
 */
export function readClaudeSettings(projectPath: string): ClaudeSettings {
  const settingsPath = path.join(projectPath, '.claude', 'settings.json');
  try {
    if (!fs.existsSync(settingsPath)) return {};
    const raw = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(raw) as ClaudeSettings;
  } catch {
    return {};
  }
}

/**
 * Write .claude/settings.json, creating .claude/ directory if needed.
 */
export function writeClaudeSettings(projectPath: string, settings: ClaudeSettings): void {
  const claudeDir = path.join(projectPath, '.claude');
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }
  const settingsPath = path.join(claudeDir, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
}

/**
 * Check if a hook entry is a SubFrame hook (command starts with .subframe/hooks/).
 */
function isSubFrameHook(hook: ClaudeHookEntry): boolean {
  return hook.command?.includes(SUBFRAME_HOOK_PREFIX) ?? false;
}

/**
 * Check if the given settings already contain SubFrame hooks.
 */
export function hasSubFrameHooks(settings: ClaudeSettings): boolean {
  if (!settings.hooks) return false;

  for (const eventType of Object.keys(settings.hooks)) {
    const matchers = settings.hooks[eventType];
    if (!Array.isArray(matchers)) continue;
    for (const matcher of matchers) {
      if (!Array.isArray(matcher.hooks)) continue;
      for (const hook of matcher.hooks) {
        if (isSubFrameHook(hook)) return true;
      }
    }
  }
  return false;
}

/**
 * Merge SubFrame hooks into existing settings. Preserves all existing hooks.
 * SubFrame hooks are added as a new matcher group (empty matcher = matches all).
 * If SubFrame hooks already exist, they are replaced with the new ones.
 */
export function mergeSubFrameHooks(
  existing: ClaudeSettings,
  subframeHooks: { hooks: ClaudeHooksConfig }
): ClaudeSettings {
  const result = { ...existing };
  if (!result.hooks) {
    result.hooks = {};
  }

  for (const eventType of Object.keys(subframeHooks.hooks)) {
    const newMatchers = subframeHooks.hooks[eventType];
    if (!Array.isArray(result.hooks[eventType])) {
      result.hooks[eventType] = [];
    }

    // Remove any existing SubFrame matchers for this event type
    result.hooks[eventType] = result.hooks[eventType].filter((matcher: ClaudeHookMatcher) => {
      if (!Array.isArray(matcher.hooks)) return true;
      // Keep the matcher if it has NO SubFrame hooks
      return !matcher.hooks.some(isSubFrameHook);
    });

    // Add the new SubFrame matchers
    result.hooks[eventType].push(...newMatchers);
  }

  return result;
}

/**
 * Remove all SubFrame hook entries from settings. Preserves everything else.
 * Returns a new settings object with SubFrame hooks stripped.
 */
export function removeSubFrameHooks(settings: ClaudeSettings): ClaudeSettings {
  const result = { ...settings };
  if (!result.hooks) return result;

  result.hooks = { ...result.hooks };

  for (const eventType of Object.keys(result.hooks)) {
    const matchers = result.hooks[eventType];
    if (!Array.isArray(matchers)) continue;

    // Filter out matchers that are entirely SubFrame hooks
    result.hooks[eventType] = matchers
      .map((matcher: ClaudeHookMatcher) => {
        if (!Array.isArray(matcher.hooks)) return matcher;
        const nonSubFrame = matcher.hooks.filter((h: ClaudeHookEntry) => !isSubFrameHook(h));
        if (nonSubFrame.length === 0) return null; // Remove entire matcher
        return { ...matcher, hooks: nonSubFrame };
      })
      .filter(Boolean) as ClaudeHookMatcher[];

    // Remove event type key if no matchers remain
    if (result.hooks[eventType].length === 0) {
      delete result.hooks[eventType];
    }
  }

  // Remove hooks key entirely if empty
  if (Object.keys(result.hooks).length === 0) {
    delete result.hooks;
  }

  return result;
}
