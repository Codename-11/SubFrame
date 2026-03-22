/**
 * GracefulShutdownDialog — UI dialog shown when closing SubFrame with active work.
 *
 * Replaces the native Electron dialog for active-work scenarios. Shows per-terminal
 * status as /exit is injected into active Claude sessions, with real-time progress.
 *
 * Triggered by: window close, update install, or app quit when AI sessions are running.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Terminal,
  Download,
  Power,
  Skull,
} from 'lucide-react';
import { useIPCEvent } from '../hooks/useIPCListener';
import { IPC } from '../../shared/ipcChannels';
import type {
  GracefulShutdownRequest,
  GracefulShutdownStatusEvent,
  GracefulShutdownCompleteEvent,
  GracefulShutdownTerminalInfo,
} from '../../shared/ipcChannels';
import { typedInvoke } from '../lib/ipc';

type TerminalStatus = GracefulShutdownTerminalInfo['status'];

const STATUS_CONFIG: Record<TerminalStatus, { icon: typeof Loader2; color: string; label: string }> = {
  waiting:  { icon: Terminal,      color: 'text-muted',   label: 'Waiting' },
  exiting:  { icon: Loader2,      color: 'text-accent',  label: 'Exiting...' },
  exited:   { icon: CheckCircle,  color: 'text-success',  label: 'Exited' },
  timeout:  { icon: AlertTriangle, color: 'text-warning', label: 'Timed out' },
  killed:   { icon: XCircle,      color: 'text-error',    label: 'Killed' },
};

export function GracefulShutdownDialog() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<'close' | 'update' | 'close-confirm'>('close');
  const [terminals, setTerminals] = useState<GracefulShutdownTerminalInfo[]>([]);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [activeStreams, setActiveStreams] = useState(false);
  const [phase, setPhase] = useState<'confirm' | 'shutting-down' | 'complete'>('confirm');

  // Listen for shutdown request from main process
  const handleRequest = useCallback((data: GracefulShutdownRequest) => {
    setReason(data.reason);
    setTerminals(data.terminals);
    setPipelineRunning(data.pipelineRunning);
    setAnalysisRunning(data.analysisRunning);
    setActiveStreams(data.activeStreams);
    setPhase('confirm');
    setOpen(true);
  }, []);

  // Listen for per-terminal status updates
  const handleStatus = useCallback((data: GracefulShutdownStatusEvent) => {
    setTerminals(prev => prev.map(t =>
      t.terminalId === data.terminalId ? { ...t, status: data.status } : t
    ));
  }, []);

  // Listen for shutdown complete
  const handleComplete = useCallback((_data: GracefulShutdownCompleteEvent) => {
    setPhase('complete');
  }, []);

  useIPCEvent<GracefulShutdownRequest>(IPC.GRACEFUL_SHUTDOWN_REQUEST, handleRequest);
  useIPCEvent<GracefulShutdownStatusEvent>(IPC.GRACEFUL_SHUTDOWN_STATUS, handleStatus);
  useIPCEvent<GracefulShutdownCompleteEvent>(IPC.GRACEFUL_SHUTDOWN_COMPLETE, handleComplete);

  // Handle confirm — start graceful shutdown
  const handleConfirm = useCallback(async () => {
    setPhase('shutting-down');
    await typedInvoke(IPC.GRACEFUL_SHUTDOWN_CONFIRM);
    // Main process handles the rest — window will be destroyed
  }, []);

  // Handle cancel
  const handleCancel = useCallback(async () => {
    setOpen(false);
    await typedInvoke(IPC.GRACEFUL_SHUTDOWN_CANCEL);
  }, []);

  // Handle force close
  const handleForce = useCallback(async () => {
    await typedInvoke(IPC.GRACEFUL_SHUTDOWN_FORCE);
    // Window will be destroyed immediately
  }, []);

  // Computed status
  const activeClaudeTerminals = terminals.filter(t => t.claudeActive);
  const inactiveTerminals = terminals.filter(t => !t.claudeActive);
  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setPhase('confirm');
      setTerminals([]);
    }
  }, [open]);

  const isUpdate = reason === 'update';
  const isSimpleConfirm = reason === 'close-confirm';
  const title = isSimpleConfirm
    ? 'Close SubFrame'
    : phase === 'complete'
      ? (isUpdate ? 'Ready to Update' : 'Shutdown Complete')
      : phase === 'shutting-down'
        ? 'Closing Sessions...'
        : (isUpdate ? 'Update — Active Work Detected' : 'Active Work in Progress');

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && phase === 'confirm') handleCancel(); }}>
      <DialogContent
        className="max-w-md bg-deep border-default"
        onPointerDownOutside={(e) => { if (phase !== 'confirm') e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (phase !== 'confirm') e.preventDefault(); }}
        showCloseButton={phase === 'confirm'}
      >
        <DialogTitle className="flex items-center gap-2 text-primary">
          {isUpdate ? (
            <Download className="h-5 w-5 text-info" />
          ) : (
            <Power className="h-5 w-5 text-warning" />
          )}
          {title}
        </DialogTitle>

        <div className="space-y-4 py-2">
          {/* Confirm phase — show what's running (or simple confirmation) */}
          {phase === 'confirm' && isSimpleConfirm && (
            <p className="text-sm text-secondary">
              Are you sure you want to close SubFrame?
            </p>
          )}
          {phase === 'confirm' && !isSimpleConfirm && (
            <>
              <p className="text-sm text-secondary">
                {isUpdate
                  ? 'An update is ready to install, but active work was detected. SubFrame can gracefully exit running sessions before restarting.'
                  : 'Active work was detected. SubFrame can gracefully exit running AI sessions before closing.'}
              </p>

              {/* Active Claude terminals */}
              {activeClaudeTerminals.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">
                    AI Sessions ({activeClaudeTerminals.length})
                  </p>
                  {activeClaudeTerminals.map(t => (
                    <div key={t.terminalId} className="flex items-center gap-2 px-2 py-1.5 rounded bg-secondary/50">
                      <Terminal className="h-3.5 w-3.5 text-accent" />
                      <span className="text-sm text-primary flex-1">{t.label}</span>
                      <span className="text-xs text-accent">Running</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Inactive terminals */}
              {inactiveTerminals.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">
                    Other Terminals ({inactiveTerminals.length})
                  </p>
                  {inactiveTerminals.map(t => (
                    <div key={t.terminalId} className="flex items-center gap-2 px-2 py-1.5 rounded bg-secondary/50">
                      <Terminal className="h-3.5 w-3.5 text-muted" />
                      <span className="text-sm text-secondary flex-1">{t.label}</span>
                      <span className="text-xs text-muted">Idle</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Other active subsystems */}
              {(pipelineRunning || analysisRunning || activeStreams) && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">Other Activity</p>
                  {pipelineRunning && (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-secondary/50">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                      <span className="text-sm text-secondary">Pipeline running</span>
                    </div>
                  )}
                  {analysisRunning && (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-secondary/50">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                      <span className="text-sm text-secondary">Project analysis in progress</span>
                    </div>
                  )}
                  {activeStreams && (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-secondary/50">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                      <span className="text-sm text-secondary">Background operations running</span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-muted">
                Graceful exit sends <code className="px-1 py-0.5 rounded bg-secondary text-accent">/exit</code> to
                active AI sessions and waits for them to save their state before closing.
              </p>
            </>
          )}

          {/* Shutting down phase — show real-time status */}
          {(phase === 'shutting-down' || phase === 'complete') && (
            <div className="space-y-2">
              {terminals.map(t => {
                const config = STATUS_CONFIG[t.status];
                const Icon = config.icon;
                const isSpinner = t.status === 'exiting';
                return (
                  <div
                    key={t.terminalId}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded transition-colors',
                      t.status === 'exited' ? 'bg-success/10' :
                      t.status === 'timeout' ? 'bg-warning/10' :
                      t.status === 'killed' ? 'bg-secondary/50' :
                      'bg-secondary/50'
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', config.color, isSpinner && 'animate-spin')} />
                    <span className="text-sm text-primary flex-1">{t.label}</span>
                    <span className={cn('text-xs', config.color)}>{config.label}</span>
                  </div>
                );
              })}

              {phase === 'complete' && (
                <div className="flex items-center gap-2 px-2 py-1.5 mt-2 rounded bg-success/10">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-sm text-success">
                    {isUpdate ? 'All sessions closed. Installing update...' : 'All sessions closed. Closing SubFrame...'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {phase === 'confirm' && isSimpleConfirm && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="text-muted hover:text-primary"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                className="bg-accent/20 text-accent hover:bg-accent/30"
              >
                <Power className="h-3.5 w-3.5 mr-1" />
                Close
              </Button>
            </>
          )}
          {phase === 'confirm' && !isSimpleConfirm && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="text-muted hover:text-primary"
              >
                Cancel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleForce}
                className="text-error hover:text-error hover:bg-error/10"
              >
                <Skull className="h-3.5 w-3.5 mr-1" />
                Force {isUpdate ? 'Restart' : 'Close'}
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                className="bg-accent/20 text-accent hover:bg-accent/30"
              >
                <Power className="h-3.5 w-3.5 mr-1" />
                Exit Gracefully
              </Button>
            </>
          )}
          {phase === 'shutting-down' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleForce}
              className="text-error hover:text-error hover:bg-error/10"
            >
              <Skull className="h-3.5 w-3.5 mr-1" />
              Force {isUpdate ? 'Restart' : 'Close'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
