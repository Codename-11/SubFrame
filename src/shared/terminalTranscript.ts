export interface RenderedTerminalTranscript {
  text: string;
  lines: string[];
}

interface RenderTerminalTranscriptOptions {
  maxLines?: number;
}

function pushLine(lines: string[], line: string): void {
  lines.push(line.replace(/[ \t]+$/g, ''));
}

export function appendTerminalTranscriptChunk(raw: string, chunk: string, maxChars = 256 * 1024): string {
  const next = raw + chunk;
  return next.length > maxChars ? next.slice(-maxChars) : next;
}

export function renderTerminalTranscript(
  raw: string,
  options: RenderTerminalTranscriptOptions = {},
): RenderedTerminalTranscript {
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];

    if (char === '\u001b') {
      const next = raw[i + 1];

      if (next === '[') {
        i += 2;
        while (i < raw.length && !/[A-Za-z~]/.test(raw[i])) {
          i += 1;
        }
        continue;
      }

      if (next === ']') {
        i += 2;
        while (i < raw.length) {
          if (raw[i] === '\u0007') {
            break;
          }
          if (raw[i] === '\u001b' && raw[i + 1] === '\\') {
            i += 1;
            break;
          }
          i += 1;
        }
        continue;
      }

      if (next === 'P' || next === '_' || next === '^') {
        i += 2;
        while (i < raw.length) {
          if (raw[i] === '\u001b' && raw[i + 1] === '\\') {
            i += 1;
            break;
          }
          i += 1;
        }
        continue;
      }

      if (next) {
        i += 1;
      }
      continue;
    }

    if (char === '\r') {
      if (raw[i + 1] === '\n') {
        pushLine(lines, currentLine);
        currentLine = '';
        i += 1;
      } else {
        currentLine = '';
      }
      continue;
    }

    if (char === '\n') {
      pushLine(lines, currentLine);
      currentLine = '';
      continue;
    }

    if (char === '\b' || char === '\u007f') {
      currentLine = currentLine.slice(0, -1);
      continue;
    }

    if (char === '\t') {
      currentLine += '  ';
      continue;
    }

    if (char < ' ') {
      continue;
    }

    currentLine += char;
  }

  if (currentLine.length > 0) {
    pushLine(lines, currentLine);
  }

  const maxLines = options.maxLines ?? 0;
  const visibleLines = maxLines > 0 && lines.length > maxLines ? lines.slice(-maxLines) : lines;

  return {
    text: visibleLines.join('\n'),
    lines: visibleLines,
  };
}
