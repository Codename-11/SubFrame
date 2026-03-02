/**
 * Claude Settings Utilities (CJS fallback)
 * Safe read/write/merge of .claude/settings.json for SubFrame hook deployment.
 * SubFrame hooks are identified by the ".subframe/hooks/" prefix in the command field.
 */

const fs = require('fs');
const path = require('path');

const SUBFRAME_HOOK_PREFIX = '.subframe/hooks/';

/**
 * Read .claude/settings.json safely. Returns empty object if missing/invalid.
 */
function readClaudeSettings(projectPath) {
  const settingsPath = path.join(projectPath, '.claude', 'settings.json');
  try {
    if (!fs.existsSync(settingsPath)) return {};
    const raw = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Write .claude/settings.json, creating .claude/ directory if needed.
 */
function writeClaudeSettings(projectPath, settings) {
  const claudeDir = path.join(projectPath, '.claude');
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }
  const settingsPath = path.join(claudeDir, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
}

/**
 * Check if a hook entry is a SubFrame hook.
 */
function isSubFrameHook(hook) {
  return hook.command?.includes(SUBFRAME_HOOK_PREFIX) ?? false;
}

/**
 * Check if the given settings already contain SubFrame hooks.
 */
function hasSubFrameHooks(settings) {
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
 */
function mergeSubFrameHooks(existing, subframeHooks) {
  const result = { ...existing };
  if (!result.hooks) {
    result.hooks = {};
  }

  for (const eventType of Object.keys(subframeHooks.hooks)) {
    if (!Array.isArray(result.hooks[eventType])) {
      result.hooks[eventType] = [];
    }

    // Remove any existing SubFrame matchers for this event type
    result.hooks[eventType] = result.hooks[eventType].filter((matcher) => {
      if (!Array.isArray(matcher.hooks)) return true;
      return !matcher.hooks.some(isSubFrameHook);
    });

    // Add the new SubFrame matchers
    result.hooks[eventType].push(...subframeHooks.hooks[eventType]);
  }

  return result;
}

/**
 * Remove all SubFrame hook entries from settings. Preserves everything else.
 */
function removeSubFrameHooks(settings) {
  const result = { ...settings };
  if (!result.hooks) return result;

  result.hooks = { ...result.hooks };

  for (const eventType of Object.keys(result.hooks)) {
    const matchers = result.hooks[eventType];
    if (!Array.isArray(matchers)) continue;

    result.hooks[eventType] = matchers
      .map((matcher) => {
        if (!Array.isArray(matcher.hooks)) return matcher;
        const nonSubFrame = matcher.hooks.filter((h) => !isSubFrameHook(h));
        if (nonSubFrame.length === 0) return null;
        return { ...matcher, hooks: nonSubFrame };
      })
      .filter(Boolean);

    if (result.hooks[eventType].length === 0) {
      delete result.hooks[eventType];
    }
  }

  if (Object.keys(result.hooks).length === 0) {
    delete result.hooks;
  }

  return result;
}

module.exports = {
  readClaudeSettings,
  writeClaudeSettings,
  hasSubFrameHooks,
  mergeSubFrameHooks,
  removeSubFrameHooks
};
