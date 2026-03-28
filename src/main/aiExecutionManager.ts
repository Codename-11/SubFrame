import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export type AIInvocationMode = 'print' | 'agent' | 'live';
export type AIInteractiveInputMethod = 'sendKeys' | 'pasteFromFile';

export interface AIInteractiveToolConfig {
  readyMarkers: string[];
  inputMethod: AIInteractiveInputMethod;
  startupDelayMs: number;
  readyTimeoutMs: number;
  settleDelayMs: number;
  fallbackQuietMs: number;
}

export interface PreparedAIInvocation {
  exe: string;
  args: string[];
  displayCommand: string;
  transcriptMode: 'live' | 'batch';
  readFinalOutput: (raw: string) => string;
  cleanup: () => void;
}

interface ParsedCommand {
  exe: string;
  args: string[];
}

function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];

    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === '\\' && i + 1 < command.length) {
        i += 1;
        current += command[i];
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function parseCommand(command: string): ParsedCommand {
  const tokens = tokenizeCommand(command);
  if (tokens.length === 0) {
    throw new Error('AI tool command is empty');
  }
  return {
    exe: tokens[0],
    args: tokens.slice(1),
  };
}

function hasArg(args: string[], ...flags: string[]): boolean {
  return args.some((arg) => flags.includes(arg));
}

function setFlagValue(args: string[], flag: string, value: string): string[] {
  const next = [...args];
  const index = next.findIndex((entry) => entry === flag);
  if (index >= 0) {
    if (index === next.length - 1) {
      next.push(value);
    } else {
      next[index + 1] = value;
    }
    return next;
  }
  next.push(flag, value);
  return next;
}

function quoteArg(arg: string): string {
  return /\s/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

export function buildDisplayCommand(exe: string, args: string[]): string {
  return [quoteArg(exe), ...args.map(quoteArg)].join(' ');
}

export function getInteractiveToolConfig(toolId: string): AIInteractiveToolConfig {
  switch (toolId) {
    case 'claude':
      return {
        readyMarkers: ['❯', 'Do you trust', 'Enter to confirm'],
        inputMethod: 'sendKeys',
        startupDelayMs: 300,
        readyTimeoutMs: 60_000,
        settleDelayMs: 2_000,
        fallbackQuietMs: 1_500,
      };
    case 'codex':
      return {
        readyMarkers: ['›', '100% left', 'model:', 'directory:'],
        inputMethod: 'pasteFromFile',
        startupDelayMs: 300,
        readyTimeoutMs: 60_000,
        settleDelayMs: 2_000,
        fallbackQuietMs: 1_500,
      };
    case 'gemini':
      return {
        readyMarkers: ['Type your message', 'Send a message'],
        inputMethod: 'pasteFromFile',
        startupDelayMs: 300,
        readyTimeoutMs: 60_000,
        settleDelayMs: 2_000,
        fallbackQuietMs: 1_500,
      };
    default:
      return {
        readyMarkers: [],
        inputMethod: 'sendKeys',
        startupDelayMs: 300,
        readyTimeoutMs: 30_000,
        settleDelayMs: 1_000,
        fallbackQuietMs: 1_500,
      };
  }
}

function unwrapEnvelopeResult(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'result' in parsed && typeof parsed.result === 'string') {
      return parsed.result;
    }
  } catch {
    // Not a result envelope.
  }
  return raw;
}

function createTempMessageFile(prefix: string): string {
  return path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`);
}

export function prepareAIInvocation(toolId: string, command: string, mode: AIInvocationMode): PreparedAIInvocation {
  const { exe, args: baseArgs } = parseCommand(command);
  let args = [...baseArgs];
  let messageFile: string | null = null;
  let transcriptMode: 'live' | 'batch' = mode === 'live' ? 'live' : 'batch';

  switch (toolId) {
    case 'claude': {
      if (mode === 'print') {
        if (!hasArg(args, '--print', '-p')) {
          args.push('--print');
        }
        if (!hasArg(args, '--output-format')) {
          args.push('--output-format', 'json');
        } else {
          args = setFlagValue(args, '--output-format', 'json');
        }
      } else {
        if (!hasArg(args, '--output-format')) {
          args.push('--output-format', 'json');
        } else {
          args = setFlagValue(args, '--output-format', 'json');
        }
        if (!hasArg(args, '--verbose')) {
          args.push('--verbose');
        }
      }
      break;
    }
    case 'codex': {
      transcriptMode = 'batch';
      messageFile = createTempMessageFile('sf-ai-last-message');
      if (!args.includes('exec')) {
        args.push('exec');
      }
      if (!args.includes('-')) {
        args.push('-');
      }
      if (!hasArg(args, '--output-last-message', '-o')) {
        args.push('--output-last-message', messageFile);
      }
      break;
    }
    case 'gemini': {
      if (mode !== 'live' && !hasArg(args, '--prompt', '-p', '--prompt-interactive', '-i')) {
        args.push('--prompt', '');
      }
      if (mode !== 'live' && !hasArg(args, '--output-format', '-o')) {
        args.push('--output-format', 'json');
      } else if (mode !== 'live' && args.includes('--output-format')) {
        args = setFlagValue(args, '--output-format', 'json');
      } else if (mode !== 'live' && args.includes('-o')) {
        args = setFlagValue(args, '-o', 'json');
      }
      break;
    }
    default: {
      if (mode === 'print' && !hasArg(args, '--print', '-p')) {
        args.push('--print');
      }
      break;
    }
  }

  return {
    exe,
    args,
    displayCommand: buildDisplayCommand(exe, args),
    transcriptMode,
    readFinalOutput: (raw: string) => {
      if (messageFile) {
        try {
          const fromFile = fs.readFileSync(messageFile, 'utf8');
          if (fromFile.trim().length > 0) {
            return fromFile;
          }
        } catch {
          // Fall back to raw output.
        }
      }
      return unwrapEnvelopeResult(raw);
    },
    cleanup: () => {
      if (messageFile) {
        try { fs.unlinkSync(messageFile); } catch { /* ignore */ }
      }
    },
  };
}

export function buildOnboardingShellCommand(
  toolId: string,
  command: string,
  shellPromptFile: string,
  shellResultFile: string,
  shellMessageFile: string,
  doneMarker: string,
  mode: AIInvocationMode = 'live',
): string {
  switch (toolId) {
    case 'claude': {
      let claudeCmd = command;
      if (!/(^|\s)--dangerously-skip-permissions(\s|$)/.test(claudeCmd)) {
        claudeCmd += ' --dangerously-skip-permissions';
      }
      if (!/(^|\s)--verbose(\s|$)/.test(claudeCmd)) {
        claudeCmd += ' --verbose';
      }
      if (!/(^|\s)--output-format(\s|$)/.test(claudeCmd)) {
        claudeCmd += ' --output-format json';
      }
      if (mode === 'print' && !/(^|\s)(--print|-p)(\s|$)/.test(claudeCmd)) {
        claudeCmd += ' --print';
      }
      return `cat "${shellPromptFile}" | ${claudeCmd} 2>&1 | tee "${shellResultFile}"; echo "${doneMarker}"`;
    }
    case 'codex': {
      const stripped = command
        .split(/\s+/)
        .filter((token) => token.length > 0 && token !== '--quiet' && token !== '-q')
        .join(' ');
      const codexExecCmd = /\bexec\b/.test(stripped)
        ? `${stripped} --output-last-message "${shellMessageFile}"`
        : `${stripped} exec - --output-last-message "${shellMessageFile}"`;
      return `cat "${shellPromptFile}" | ${codexExecCmd} 2>&1 | tee "${shellResultFile}"; echo "${doneMarker}"`;
    }
    case 'gemini': {
      const geminiCmd = mode === 'live'
        ? command
        : /(^|\s)(--prompt|-p)(\s|$)/.test(command)
          ? command
          : `${command} --prompt ""`;
      return `cat "${shellPromptFile}" | ${geminiCmd} 2>&1 | tee "${shellResultFile}"; echo "${doneMarker}"`;
    }
    default:
      return `cat "${shellPromptFile}" | ${command} 2>&1 | tee "${shellResultFile}"; echo "${doneMarker}"`;
  }
}

export function buildInteractiveAICommand(
  toolId: string,
  command: string,
): string {
  switch (toolId) {
    case 'claude': {
      let claudeCmd = command;
      if (!/(^|\s)--dangerously-skip-permissions(\s|$)/.test(claudeCmd)) {
        claudeCmd += ' --dangerously-skip-permissions';
      }
      if (!/(^|\s)--verbose(\s|$)/.test(claudeCmd)) {
        claudeCmd += ' --verbose';
      }
      return claudeCmd.trim();
    }
    case 'codex': {
      let codexCmd = command
        .replace(/\s--quiet(\s|$)/g, ' ')
        .replace(/\s-q(\s|$)/g, ' ')
        .replace(/\sexec(\s|$)/g, ' ')
        .trim();
      if (!/(^|\s)--no-alt-screen(\s|$)/.test(codexCmd)) {
        codexCmd += ' --no-alt-screen';
      }
      return codexCmd.trim();
    }
    case 'gemini': {
      if (/(^|\s)(--prompt-interactive|-i)(\s|$)/.test(command)) {
        return command.trim();
      }
      return `${command} --prompt-interactive`.trim();
    }
    default:
      return command.trim();
  }
}

export const buildInteractiveOnboardingCommand = buildInteractiveAICommand;
