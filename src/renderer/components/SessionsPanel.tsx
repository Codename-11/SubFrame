/**
 * SessionsPanel — Claude Code session list with resume, rename, delete functionality.
 */

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, Play, ChevronDown, ChevronRight, Pencil, Trash2, Trash } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { sendCommandToTerminal } from '../lib/promptUtils';
import { useSessions } from '../hooks/useSessions';
import { useSettings, useAIToolConfig } from '../hooks/useSettings';
import { useProjectStore } from '../stores/useProjectStore';
import { useTerminalStore } from '../stores/useTerminalStore';
import type { ClaudeSession, SessionSegment } from '../../shared/ipcChannels';

function formatRelativeTime(dateString: string | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return date.toLocaleDateString();
}

const STATE_DOT: Record<string, string> = {
  active: 'bg-emerald-400 animate-pulse',
  recent: 'bg-amber-400',
  inactive: 'bg-zinc-500',
};

/** Inline rename input for a session */
function RenameInput({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSubmit(value);
        } else if (e.key === 'Escape') {
          onCancel();
        }
      }}
      onBlur={() => onSubmit(value)}
      className="h-6 text-xs px-1.5 py-0 bg-bg-secondary border-border-subtle"
      placeholder="Session name..."
    />
  );
}

const MAX_VISIBLE_SEGMENTS = 5;

/** Vertical stepper timeline showing individual segments of a conversation chain */
function SegmentTimeline({
  segments,
  showAll,
  onToggleShowAll,
  onResume,
}: {
  segments: SessionSegment[];
  showAll: boolean;
  onToggleShowAll: () => void;
  onResume: (seg: SessionSegment) => void;
}) {
  // Segments arrive oldest→newest; reverse for display (newest at top)
  const reversed = [...segments].reverse();
  const visible = showAll ? reversed : reversed.slice(0, MAX_VISIBLE_SEGMENTS);
  const hasMore = segments.length > MAX_VISIBLE_SEGMENTS;

  return (
    <ScrollArea className="max-h-60 px-3 pb-2">
      <div className="ml-[3px]">
        {visible.map((seg, i) => {
          const isLast = i === visible.length - 1;
          const prompt = seg.firstPrompt || 'Untitled';

          return (
            <div
              key={seg.sessionId}
              className={cn(
                'relative pl-4',
                !isLast && 'border-l-2 border-border-subtle',
              )}
            >
              {/* Dot */}
              <div
                className={cn(
                  'absolute -left-[4px] top-1 w-[9px] h-[9px] rounded-full border-2 border-bg-primary',
                  STATE_DOT[seg.state],
                )}
              />

              {/* Segment content */}
              <div className="flex items-start gap-2 pb-3 group/seg">
                <div className="flex-1 min-w-0 pt-px">
                  <div className="text-[11px] text-text-primary line-clamp-1">{prompt}</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">
                    {formatRelativeTime(seg.modified)} · {seg.messageCount} msg{seg.messageCount !== 1 ? 's' : ''}
                    {seg.gitBranch && (
                      <span className="ml-1.5 text-text-muted">on {seg.gitBranch}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResume(seg);
                  }}
                  className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-bg-hover transition-colors cursor-pointer opacity-0 group-hover/seg:opacity-100 shrink-0"
                  title="Resume this segment"
                >
                  <Play size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show all toggle */}
      {hasMore && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleShowAll();
          }}
          className="text-[10px] text-accent hover:text-accent/80 ml-4 mt-0.5 cursor-pointer"
        >
          {showAll ? 'Show fewer' : `Show all ${segments.length} segments`}
        </button>
      )}
    </ScrollArea>
  );
}

export function SessionsPanel() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const { sessions, isLoading, refetch, renameSession, deleteSession, deleteAllSessions } = useSessions();
  const { config: aiToolConfig } = useAIToolConfig();
  const { settings } = useSettings();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClaudeSession | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [showAllSegments, setShowAllSegments] = useState(false);

  // Resolve the active tool's start command (respecting custom override from settings)
  const activeTool = aiToolConfig?.activeTool;
  const aiToolSettings = (settings?.aiTools as Record<string, Record<string, unknown>>) || {};
  const customCmd = activeTool ? (aiToolSettings[activeTool.id]?.customCommand as string) : '';
  const defaultStartCommand = customCmd || activeTool?.command || 'claude';

  async function handleRefresh() {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }

  function resumeSession(session: ClaudeSession, command?: string, segmentSessionId?: string) {
    const cmd = command ?? defaultStartCommand;
    const target = segmentSessionId ?? session.sessionId;

    // Find the terminal correlated to this session (if any) to avoid
    // sending the resume command to the wrong terminal
    const { terminals } = useTerminalStore.getState();
    let correlatedTerminalId: string | undefined;
    for (const [, info] of terminals) {
      if (info.claudeSessionId === session.sessionId) {
        correlatedTerminalId = info.id;
        break;
      }
    }

    sendCommandToTerminal(`${cmd} --resume ${target}`, correlatedTerminalId);
  }

  function handleRename(session: ClaudeSession, name: string) {
    setRenamingId(null);
    const trimmed = name.trim();
    // Only save if the name actually changed
    const currentName = session.friendlyName || '';
    if (trimmed !== currentName) {
      renameSession(session.sessionId, trimmed);
      toast.success('Session renamed');
    }
  }

  function handleDelete(session: ClaudeSession) {
    deleteSession(session.sessionId, session.slug);
    setDeleteTarget(null);
    toast.success('Session deleted');
  }

  function handleDeleteAll() {
    deleteAllSessions();
    setShowDeleteAll(false);
    toast.success('All sessions cleared');
  }

  if (!projectPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-sm gap-1">
        <span>No project selected</span>
        <span className="text-xs opacity-60">Select a project in the left sidebar to view sessions</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
        <span className="text-xs text-text-secondary">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-0.5">
          {sessions.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDeleteAll(true)}
              className="h-7 px-2 cursor-pointer text-text-tertiary hover:text-error"
              title="Clean up all sessions"
            >
              <Trash size={14} />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-7 px-2 cursor-pointer"
          >
            <RefreshCw size={14} className={cn(isRefreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading && sessions.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">
            Loading sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-1">
            <span>No sessions yet</span>
            <span className="text-xs opacity-60">Start an AI tool to begin</span>
          </div>
        ) : (
          <div className="flex flex-col">
            {sessions.map((s) => {
              const displayTitle = s.friendlyName || s.customTitle || s.firstPrompt || s.slug || 'Untitled session';
              const originalName = s.friendlyName
                ? (s.customTitle || s.firstPrompt || s.slug || 'Untitled session')
                : null;
              const branch = s.gitBranch || undefined;
              const modified = s.modified || undefined;
              const msgCount = s.messageCount || 0;
              const isRenaming = renamingId === s.sessionId;
              const hasSegments = s.segmentCount > 1 && s.segments && s.segments.length > 1;
              const isExpanded = expandedSlug === s.slug && hasSegments;

              return (
                <div
                  key={s.sessionId}
                  className="border-b border-border-subtle/50"
                >
                  {/* Session row */}
                  <div
                    className={cn(
                      'flex items-start gap-3 px-3 py-2.5 hover:bg-bg-hover/30 transition-colors group',
                      hasSegments && 'cursor-pointer',
                    )}
                    onClick={() => {
                      if (!hasSegments) return;
                      setExpandedSlug(prev => prev === s.slug ? null : s.slug);
                      setShowAllSegments(false);
                    }}
                  >
                    {/* Expand chevron or state dot */}
                    {hasSegments ? (
                      <ChevronRight
                        size={14}
                        className={cn(
                          'shrink-0 mt-1 text-text-tertiary transition-transform duration-200',
                          isExpanded && 'rotate-90',
                        )}
                      />
                    ) : (
                      <div className={cn('w-2 h-2 rounded-full shrink-0 mt-1.5', STATE_DOT[s.state])} title={s.state} />
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <RenameInput
                          initial={s.friendlyName || ''}
                          onSubmit={(name) => handleRename(s, name)}
                          onCancel={() => setRenamingId(null)}
                        />
                      ) : (
                        <>
                          <div className="text-xs font-medium text-text-primary line-clamp-2 break-words">{displayTitle}</div>
                          {originalName && (
                            <div className="text-[10px] text-text-tertiary truncate mt-0.5 italic opacity-60">
                              {originalName}
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-text-tertiary flex-wrap min-w-0">
                        <span className="shrink-0">{formatRelativeTime(modified || s.created)}</span>
                        <span className="shrink-0">{msgCount} msg{msgCount !== 1 ? 's' : ''}</span>
                        {hasSegments && (
                          <span className="text-text-muted shrink-0">{s.segmentCount} segments</span>
                        )}
                        {branch && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-bg-hover text-text-secondary truncate max-w-[120px]">
                            {branch}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div
                      className="flex items-center gap-0.5 shrink-0 mt-0.5 opacity-50 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => resumeSession(s)}
                        className="p-1.5 rounded text-text-tertiary hover:text-accent hover:bg-bg-hover transition-colors cursor-pointer"
                        title="Resume session"
                      >
                        <Play size={14} />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                            title="Session options"
                          >
                            <ChevronDown size={12} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-bg-primary border-border-subtle min-w-[160px]"
                        >
                          <DropdownMenuItem
                            onClick={() => resumeSession(s)}
                            className="text-xs cursor-pointer"
                          >
                            <Play size={12} className="mr-1.5" />
                            {defaultStartCommand} (default)
                          </DropdownMenuItem>
                          {defaultStartCommand !== 'claude' && (
                            <DropdownMenuItem
                              onClick={() => resumeSession(s, 'claude')}
                              className="text-xs cursor-pointer"
                            >
                              <Play size={12} className="mr-1.5 opacity-0" />
                              claude
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              // Find correlated terminal for this session
                              const { terminals: allTerminals } = useTerminalStore.getState();
                              let tid: string | undefined;
                              for (const [, info] of allTerminals) {
                                if (info.claudeSessionId === s.sessionId) { tid = info.id; break; }
                              }
                              sendCommandToTerminal(`${defaultStartCommand} --continue`, tid);
                            }}
                            className="text-xs cursor-pointer"
                          >
                            <Play size={12} className="mr-1.5 opacity-0" />
                            {defaultStartCommand} --continue
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const cmd = window.prompt('Enter command to resume session:', defaultStartCommand);
                              if (cmd?.trim()) resumeSession(s, cmd.trim());
                            }}
                            className="text-xs cursor-pointer"
                          >
                            <Play size={12} className="mr-1.5 opacity-0" />
                            Custom command...
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={() => setRenamingId(s.sessionId)}
                            className="text-xs cursor-pointer"
                          >
                            <Pencil size={12} className="mr-1.5" />
                            Rename...
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(s)}
                            className="text-xs cursor-pointer text-error focus:text-error"
                          >
                            <Trash2 size={12} className="mr-1.5" />
                            Delete session
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Expandable segment timeline */}
                  <AnimatePresence initial={false}>
                    {isExpanded && s.segments && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <SegmentTimeline
                          segments={s.segments}
                          showAll={showAllSegments}
                          onToggleShowAll={() => setShowAllSegments(prev => !prev)}
                          onResume={(seg) => {
                            resumeSession(s, undefined, seg.sessionId);
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Delete single session confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-bg-primary border-border-subtle">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-text-primary">Delete session?</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary">
              This will permanently delete the session
              {deleteTarget?.friendlyName || deleteTarget?.customTitle || deleteTarget?.firstPrompt
                ? ` "${deleteTarget.friendlyName || deleteTarget.customTitle || deleteTarget.firstPrompt}"`
                : ''}
              {deleteTarget && deleteTarget.segmentCount > 1
                ? ` and its ${deleteTarget.segmentCount} segments`
                : ''}.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-error hover:bg-error/90 cursor-pointer"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete all sessions confirmation */}
      <AlertDialog open={showDeleteAll} onOpenChange={setShowDeleteAll}>
        <AlertDialogContent className="bg-bg-primary border-border-subtle">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-text-primary">Clean up all sessions?</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary">
              This will permanently delete all {sessions.length} session{sessions.length !== 1 ? 's' : ''} for this project.
              Session history files will be removed from disk. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              className="bg-error hover:bg-error/90 cursor-pointer"
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
