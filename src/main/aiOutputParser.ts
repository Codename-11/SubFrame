/**
 * Shared parsers for AI transcript output.
 * Interactive sessions often contain prompt echoes, banners, and shell text
 * around the actual final JSON result.
 */

export interface StructuredResultMarkers {
  startMarker: string;
  endMarker: string;
  afterMarker?: string | null;
}

function stripAnsi(text: string): string {
  return text.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    '',
  );
}

function parseLastJsonFence(text: string): unknown {
  const matches = [...text.matchAll(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/g)];
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const candidate = matches[index]?.[1]?.trim();
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // Keep scanning earlier fenced blocks.
    }
  }
  return null;
}

function parseLastBalancedJson(text: string): unknown {
  for (let start = text.length - 1; start >= 0; start -= 1) {
    const first = text[start];
    if (first !== '{' && first !== '[') continue;

    const stack: string[] = [first === '{' ? '}' : ']'];
    let inString = false;
    let escaped = false;

    for (let index = start + 1; index < text.length; index += 1) {
      const char = text[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === '{') {
        stack.push('}');
        continue;
      }
      if (char === '[') {
        stack.push(']');
        continue;
      }
      if (char === '}' || char === ']') {
        if (stack[stack.length - 1] !== char) {
          break;
        }
        stack.pop();
        if (stack.length === 0) {
          const candidate = text.slice(start, index + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }

  return null;
}

export function extractMarkedBlock(
  text: string,
  markers: StructuredResultMarkers,
): string | null {
  const cleaned = stripAnsi(text);
  const scopeStart = markers.afterMarker
    ? cleaned.lastIndexOf(markers.afterMarker)
    : -1;
  const scoped = scopeStart >= 0
    ? cleaned.slice(scopeStart + markers.afterMarker!.length)
    : cleaned;

  const endIndex = scoped.lastIndexOf(markers.endMarker);
  if (endIndex < 0) return null;

  const startIndex = scoped.lastIndexOf(markers.startMarker, endIndex);
  if (startIndex < 0) return null;

  const candidate = scoped.slice(startIndex + markers.startMarker.length, endIndex).trim();
  return candidate.length > 0 ? candidate : null;
}

export function createStructuredJsonPrompt(
  prompt: string,
  token: string,
): { prompt: string; markers: StructuredResultMarkers } {
  const startMarker = `__SF_RESULT_START_${token}__`;
  const endMarker = `__SF_RESULT_END_${token}__`;
  const afterMarker = `__SF_PROMPT_END_${token}__`;

  return {
    prompt: `${prompt}

When you provide the final answer, output exactly:
${startMarker}
<valid JSON only>
${endMarker}

Do not wrap the JSON in markdown fences.
Do not print any explanation before or after the markers.
${afterMarker}`,
    markers: {
      startMarker,
      endMarker,
      afterMarker,
    },
  };
}

export function parseJsonFromMixedOutput(text: string): unknown {
  const cleaned = stripAnsi(text).trim();
  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue through progressively looser extractors.
  }

  const fenced = parseLastJsonFence(cleaned);
  if (fenced !== null) {
    return fenced;
  }

  return parseLastBalancedJson(cleaned);
}

export { stripAnsi };
