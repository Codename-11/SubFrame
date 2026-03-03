/**
 * HistoryPanel — Prompt history list.
 * Loads via LOAD_PROMPT_HISTORY send/on pattern.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { typedSend } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';

const { ipcRenderer } = require('electron');

interface HistoryEntry {
  timestamp: string;
  command: string;
}

function parseHistory(raw: string): HistoryEntry[] {
  if (!raw || raw.trim() === '') return [];
  const lines = raw.trim().split('\n');
  const entries: HistoryEntry[] = [];
  for (const line of lines) {
    const match = line.match(/\[(.*?)\]\s+(.*)/);
    if (match) {
      entries.push({
        timestamp: match[1],
        command: match[2],
      });
    }
  }
  // Newest first
  return entries.reverse();
}

export function HistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const loaded = useRef(false);

  const handleData = useCallback((_event: unknown, data: string) => {
    setEntries(parseHistory(data));
  }, []);

  useEffect(() => {
    ipcRenderer.on(IPC.PROMPT_HISTORY_DATA, handleData);
    if (!loaded.current) {
      typedSend(IPC.LOAD_PROMPT_HISTORY);
      loaded.current = true;
    }
    return () => {
      ipcRenderer.removeListener(IPC.PROMPT_HISTORY_DATA, handleData);
    };
  }, [handleData]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border-subtle shrink-0">
        <span className="text-xs text-text-secondary">
          {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
        </span>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-1">
            <span>No history yet</span>
            <span className="text-xs opacity-60">Run commands in the terminal to build prompt history</span>
          </div>
        ) : (
          <div className="flex flex-col">
            {entries.map((entry, i) => (
              <div
                key={i}
                className="px-3 py-2.5 border-b border-border-subtle/50 hover:bg-bg-hover/30 transition-colors"
              >
                <div className="text-[10px] text-text-tertiary mb-0.5">
                  {formatTimestamp(entry.timestamp)}
                </div>
                <div className="text-xs text-text-primary font-mono break-all">
                  {entry.command}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}
