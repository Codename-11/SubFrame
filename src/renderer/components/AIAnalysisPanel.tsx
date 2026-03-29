/**
 * AIAnalysisPanel — Interactive AI analysis panel for the right sidebar.
 * Lets users send prompts to an AI tool running in a terminal and see the
 * conversation history. Supports follow-up prompts to the same session.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Send,
  Terminal as TerminalIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Shield,
  Zap,
  Search,
  Lightbulb,
  Trash2,
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import { useProjectStore } from '../stores/useProjectStore';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useUIStore } from '../stores/useUIStore';
import { useIpcMutation } from '../hooks/useIpc';
import { useIPCEvent } from '../hooks/useIPCListener';
import { IPC } from '../../shared/ipcChannels';

interface PromptEntry {
  id: string;
  prompt: string;
  timestamp: string;
  terminalId: string;
}

type AnalysisStatus = 'idle' | 'running' | 'complete' | 'error';

const QUICK_ACTIONS = [
  { label: 'Review Code Quality', icon: Search, prompt: 'Review this project\'s code quality. Look at the overall architecture, coding patterns, and suggest improvements. Be specific about file paths and line numbers.' },
  { label: 'Find Bugs', icon: AlertCircle, prompt: 'Analyze this project for potential bugs, edge cases, and error handling issues. Focus on logic errors, race conditions, and unhandled states.' },
  { label: 'Security Audit', icon: Shield, prompt: 'Perform a security audit of this project. Check for common vulnerabilities like injection, XSS, insecure dependencies, exposed secrets, and authentication issues.' },
  { label: 'Performance Check', icon: Zap, prompt: 'Analyze this project for performance issues. Look for unnecessary re-renders, memory leaks, slow algorithms, missing caching, and bundle size concerns.' },
  { label: 'Suggest Improvements', icon: Lightbulb, prompt: 'Suggest improvements for this project. Consider developer experience, code maintainability, testing gaps, and modern best practices.' },
];

export function AIAnalysisPanel() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal);
  const setFullViewContent = useUIStore((s) => s.setFullViewContent);

  const [promptText, setPromptText] = useState('');
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [history, setHistory] = useState<PromptEntry[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const runAnalysis = useIpcMutation(IPC.RUN_AI_ANALYSIS);

  // Listen for status events
  useIPCEvent<{ projectPath: string; status: 'running' | 'complete' | 'error'; message?: string; terminalId?: string }>(
    IPC.AI_ANALYSIS_STATUS,
    useCallback((data) => {
      if (data.projectPath !== projectPath) return;
      setStatus(data.status === 'running' ? 'running' : data.status === 'complete' ? 'complete' : data.status === 'error' ? 'error' : 'idle');
      if (data.message) setStatusMessage(data.message);
      if (data.terminalId) setActiveTerminalId(data.terminalId);
    }, [projectPath]),
  );

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [promptText]);

  // Scroll to bottom when history updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSubmit = useCallback(async (prompt: string) => {
    if (!prompt.trim() || !projectPath) return;

    const entry: PromptEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      prompt: prompt.trim(),
      timestamp: new Date().toISOString(),
      terminalId: activeTerminalId || '',
    };

    setHistory((prev) => [...prev, entry]);
    setPromptText('');
    setStatus('running');
    setStatusMessage('Sending to AI...');

    try {
      const result = await runAnalysis.mutateAsync([{
        projectPath,
        prompt: prompt.trim(),
        terminalId: activeTerminalId || undefined,
      }]);
      setActiveTerminalId(result.terminalId);
      entry.terminalId = result.terminalId;
      // Update the entry with the terminal ID
      setHistory((prev) => prev.map((e) => e.id === entry.id ? { ...e, terminalId: result.terminalId } : e));
    } catch (err) {
      setStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Failed to run analysis');
    }
  }, [projectPath, activeTerminalId, runAnalysis]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(promptText);
    }
  }, [handleSubmit, promptText]);

  const handleViewTerminal = useCallback(() => {
    if (!activeTerminalId) return;
    setActiveTerminal(activeTerminalId);
    setFullViewContent(null); // Switch to terminal view
  }, [activeTerminalId, setActiveTerminal, setFullViewContent]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    setActiveTerminalId(null);
    setStatus('idle');
    setStatusMessage('');
  }, []);

  if (!projectPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-sm gap-1">
        <Bot size={24} className="text-text-muted mb-1" />
        <span>No project selected</span>
      </div>
    );
  }

  const StatusIcon = status === 'running' ? Loader2 : status === 'complete' ? CheckCircle2 : status === 'error' ? AlertCircle : Bot;
  const statusColor = status === 'running' ? 'text-accent' : status === 'complete' ? 'text-success' : status === 'error' ? 'text-error' : 'text-text-tertiary';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <motion.div
            animate={status === 'running' ? { rotate: 360 } : {}}
            transition={status === 'running' ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
          >
            <StatusIcon
              size={14}
              className={cn(statusColor, status === 'running' && 'animate-spin')}
            />
          </motion.div>
          <span className="text-xs font-medium text-text-primary">
            {status === 'idle' ? 'Ready' : status === 'running' ? 'Analyzing...' : status === 'complete' ? 'Complete' : 'Error'}
          </span>
          {statusMessage && status !== 'idle' && (
            <span className="text-[10px] text-text-tertiary truncate max-w-[140px]">{statusMessage}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeTerminalId && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleViewTerminal}
              className="h-6 px-2 text-[10px] gap-1 cursor-pointer"
              title="View in Terminal"
            >
              <TerminalIcon size={12} />
              Terminal
            </Button>
          )}
          {history.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearHistory}
              className="h-6 px-1.5 cursor-pointer text-text-tertiary hover:text-text-primary"
              title="Clear history"
            >
              <Trash2 size={12} />
            </Button>
          )}
        </div>
      </div>

      {/* Content area — prompt history + quick actions */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={scrollRef} className="p-3 space-y-3">
          {/* Empty state — quick actions */}
          {history.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              <div className="text-center py-4">
                <Bot size={28} className="mx-auto text-text-muted mb-2" />
                <p className="text-xs text-text-secondary mb-1">AI Analysis</p>
                <p className="text-[10px] text-text-tertiary max-w-[220px] mx-auto">
                  Ask the AI to analyze, fix, or improve your code. Opens an interactive terminal session.
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">Quick Actions</span>
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => handleSubmit(action.prompt)}
                      disabled={runAnalysis.isPending}
                      className={cn(
                        'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors cursor-pointer',
                        'bg-bg-secondary/50 hover:bg-bg-hover border border-border-subtle hover:border-border-default',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      <Icon size={13} className="text-accent flex-shrink-0" />
                      <span className="text-xs text-text-primary">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Prompt history */}
          <AnimatePresence>
            {history.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="group relative"
              >
                <div className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-bg-secondary/70 border border-border-subtle">
                  <Sparkles size={12} className="text-accent mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-primary whitespace-pre-wrap break-words line-clamp-4">
                      {entry.prompt}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-text-muted">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {entry.terminalId && (
                        <button
                          onClick={() => {
                            setActiveTerminal(entry.terminalId);
                            setFullViewContent(null);
                          }}
                          className="text-[10px] text-accent hover:underline cursor-pointer"
                        >
                          View output
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Input area — fixed at bottom */}
      <div className="shrink-0 border-t border-border-subtle p-2 bg-bg-primary">
        {/* Quick action chips when history exists */}
        {history.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {QUICK_ACTIONS.slice(0, 3).map((action) => (
              <button
                key={action.label}
                onClick={() => handleSubmit(action.prompt)}
                disabled={runAnalysis.isPending}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] transition-colors cursor-pointer',
                  'bg-bg-secondary hover:bg-bg-hover border border-border-subtle text-text-secondary hover:text-text-primary',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                <action.icon size={10} />
                {action.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-1.5">
          <textarea
            ref={textareaRef}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI to analyze, fix, or improve..."
            rows={1}
            className={cn(
              'flex-1 resize-none rounded-md border border-border-subtle bg-bg-secondary px-3 py-2',
              'text-xs text-text-primary placeholder:text-text-muted',
              'focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20',
              'scrollbar-thin',
            )}
            style={{ minHeight: '34px', maxHeight: '120px' }}
          />
          <Button
            size="sm"
            onClick={() => handleSubmit(promptText)}
            disabled={!promptText.trim() || runAnalysis.isPending}
            className="h-[34px] px-3 bg-accent hover:bg-accent/90 text-bg-deep cursor-pointer disabled:opacity-50"
            title="Run Analysis (Enter)"
          >
            {runAnalysis.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-text-muted mt-1 px-1">
          Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
