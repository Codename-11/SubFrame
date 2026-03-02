/**
 * AIFilesPanel — AI instruction file status and management.
 * Shows CLAUDE.md, GEMINI.md, AGENTS.md, Codex wrapper status with action buttons.
 * Includes backlink verification, config customization, update-all,
 * .claude/ directory info section, and auto-verify on frame status change.
 */

import { useState, useEffect, useRef } from 'react';
import {
  RefreshCw, Link, Unlink, Plus, ArrowRightLeft, FileEdit,
  CheckCircle, XCircle, AlertTriangle, Shield, ChevronDown,
  ChevronRight, Save, Loader2, Info, FolderOpen,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { useAIFiles } from '../hooks/useAIFiles';
import { useProjectStore } from '../stores/useProjectStore';
import { useUIStore } from '../stores/useUIStore';
import { toast } from 'sonner';
import type { NativeFileStatus, BacklinkConfig, ClaudeSettingsStatus } from '../../shared/ipcChannels';

interface AIFileDefinition {
  key: string;
  label: string;
  filename: string;
  supportsBacklink: boolean;
  description: string;
}

const AI_FILES: AIFileDefinition[] = [
  { key: 'agents', label: 'AGENTS.md', filename: 'AGENTS.md', supportsBacklink: false, description: 'Shared AI rules — source of truth for all tools' },
  { key: 'claude', label: 'CLAUDE.md', filename: 'CLAUDE.md', supportsBacklink: true, description: 'Claude Code instructions — backlink injects shared rules' },
  { key: 'gemini', label: 'GEMINI.md', filename: 'GEMINI.md', supportsBacklink: true, description: 'Gemini CLI instructions — backlink injects shared rules' },
  { key: 'codexWrapper', label: 'Codex wrapper', filename: '.subframe/bin/codex', supportsBacklink: false, description: 'Shell wrapper that injects AGENTS.md context on launch' },
];

function getStatusInfo(file: AIFileDefinition, status: NativeFileStatus | { exists: boolean }) {
  const s = status as NativeFileStatus;
  if (!s.exists) {
    return { label: 'Missing', color: 'bg-red-900/60 text-red-300', icon: XCircle };
  }
  if (s.isSymlink) {
    return { label: 'Legacy symlink', color: 'bg-amber-900/60 text-amber-300', icon: AlertTriangle };
  }
  if (file.supportsBacklink) {
    if (s.hasBacklink) {
      return { label: 'Backlink active', color: 'bg-emerald-900/60 text-emerald-300', icon: CheckCircle };
    }
    return { label: 'No backlink', color: 'bg-amber-900/60 text-amber-300', icon: AlertTriangle };
  }
  return { label: 'Present', color: 'bg-emerald-900/60 text-emerald-300', icon: CheckCircle };
}

/** Severity badge for verification issues */
function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    error: 'bg-red-900/60 text-red-300',
    warning: 'bg-amber-900/60 text-amber-300',
    info: 'bg-blue-900/60 text-blue-300',
  };
  return (
    <Badge variant="secondary" className={cn('text-[9px] px-1.5 py-0', styles[severity] || styles.info)}>
      {severity}
    </Badge>
  );
}

/** Read-only .claude/ directory info section */
function ClaudeSettingsSection({ claudeSettings }: { claudeSettings: ClaudeSettingsStatus }) {
  if (!claudeSettings?.exists) return null;

  const details: string[] = [];
  if (claudeSettings.hasConfig) details.push('settings.json');
  if (claudeSettings.hasMemory) details.push('memory.md');
  if (claudeSettings.hasProjects) details.push('projects/');

  const detailsText = details.length > 0 ? details.join(', ') : 'empty';

  return (
    <div className="mt-3 pt-3 border-t border-border-subtle/50">
      <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-2">
        .claude/ Directory
      </div>
      <div className="flex items-center gap-3 p-3 rounded-md bg-bg-deep/50 border border-border-subtle/50">
        <FolderOpen size={16} className="text-blue-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-primary font-mono">.claude/</span>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-blue-900/60 text-blue-300">
              Detected
            </Badge>
          </div>
          <div className="text-[10px] text-text-tertiary mt-0.5">
            Contains: {detailsText}
          </div>
          <div className="text-[10px] text-text-muted mt-0.5 italic">
            Managed by Claude Code — SubFrame deploys skills to .claude/skills/
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIFilesPanel() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const isFrameProject = useProjectStore((s) => s.isFrameProject);
  const setEditorFilePath = useUIStore((s) => s.setEditorFilePath);
  const {
    status, isLoading, refetch,
    injectBacklink, removeBacklink, createFile, migrateSymlink,
    verifyBacklinks, verificationResult, isVerifying,
    backlinkConfig, backlinkConfigLoaded, loadBacklinkConfig, saveBacklinkConfig, updateAllBacklinks,
  } = useAIFiles();

  // ── Local config editing state ──
  const [configOpen, setConfigOpen] = useState(false);
  const [editCustomMessage, setEditCustomMessage] = useState('');
  const [editAdditionalRefs, setEditAdditionalRefs] = useState('');

  // ── Auto-verify on frame status change ──
  const prevIsFrame = useRef(isFrameProject);
  useEffect(() => {
    if (isFrameProject && !prevIsFrame.current) {
      // Project just became a frame project — auto-verify backlinks
      verifyBacklinks();
    }
    prevIsFrame.current = isFrameProject;
  }, [isFrameProject, verifyBacklinks]);

  // Sync local editing state when backlink config arrives
  useEffect(() => {
    if (backlinkConfig) {
      setEditCustomMessage(backlinkConfig.customMessage || '');
      setEditAdditionalRefs((backlinkConfig.additionalRefs || []).join(', '));
    }
  }, [backlinkConfig]);

  // Load config when the section is opened
  useEffect(() => {
    if (configOpen && !backlinkConfigLoaded && projectPath) {
      loadBacklinkConfig();
    }
  }, [configOpen, backlinkConfigLoaded, projectPath, loadBacklinkConfig]);

  // Reset local editing state when project changes
  useEffect(() => {
    setEditCustomMessage('');
    setEditAdditionalRefs('');
  }, [projectPath]);

  if (!projectPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-sm gap-1">
        <span>No project selected</span>
        <span className="text-xs opacity-60">AI file status will appear here</span>
      </div>
    );
  }

  const handleSaveConfig = () => {
    const config: BacklinkConfig = {
      customMessage: editCustomMessage.trim(),
      additionalRefs: editAdditionalRefs
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean),
    };
    saveBacklinkConfig.mutate(config, {
      onSuccess: () => toast.success('Backlink config saved'),
    });
  };

  const handleUpdateAll = () => {
    updateAllBacklinks.mutate(undefined, {
      onSuccess: () => toast.success('All backlinks updated'),
    });
  };

  // Extract claudeSettings from status for the .claude/ directory section
  const claudeSettings = status
    ? (status as unknown as { claudeSettings?: ClaudeSettingsStatus }).claudeSettings
    : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
        <span className="text-xs text-text-secondary font-medium">AI Instruction Files</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={refetch}
          className="h-7 px-2 cursor-pointer"
        >
          <RefreshCw size={14} />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isLoading && !status ? (
          <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">
            Loading...
          </div>
        ) : !status ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-1">
            <span>No status available</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-3">
            {/* ── File list ── */}
            {AI_FILES.map((file) => {
              const fileStatus = (status as unknown as Record<string, NativeFileStatus | { exists: boolean }>)[file.key];
              if (!fileStatus) return null;
              const info = getStatusInfo(file, fileStatus);
              const StatusIcon = info.icon;
              const s = fileStatus as NativeFileStatus;

              return (
                <div
                  key={file.key}
                  className="flex items-center gap-3 p-3 rounded-md bg-bg-deep/50 border border-border-subtle/50"
                >
                  {/* Status icon */}
                  <StatusIcon size={16} className={cn(
                    info.label === 'Missing' ? 'text-red-400' :
                    info.label === 'Backlink active' || info.label === 'Present' ? 'text-emerald-400' :
                    'text-amber-400'
                  )} />

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-primary">{file.label}</span>
                      <Badge variant="secondary" className={cn('text-[9px] px-1.5 py-0', info.color)}>
                        {info.label}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-text-tertiary mt-0.5">
                      {file.description}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {/* Edit button — opens in-app editor */}
                    {s.exists && (
                      <button
                        onClick={() => setEditorFilePath(projectPath + '/' + file.filename)}
                        className="p-1.5 rounded text-text-tertiary hover:text-accent hover:bg-bg-hover transition-colors cursor-pointer"
                        title="Edit file"
                      >
                        <FileEdit size={12} />
                      </button>
                    )}
                    {s.exists && file.supportsBacklink && !s.isSymlink && (
                      s.hasBacklink ? (
                        <button
                          onClick={() => {
                            removeBacklink.mutate(file.filename);
                            toast.info('Backlink removed');
                          }}
                          className="p-1.5 rounded text-text-tertiary hover:text-red-400 hover:bg-bg-hover transition-colors cursor-pointer"
                          title="Remove backlink"
                        >
                          <Unlink size={12} />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            injectBacklink.mutate(file.filename);
                            toast.success('Backlink injected');
                          }}
                          className="p-1.5 rounded text-text-tertiary hover:text-accent hover:bg-bg-hover transition-colors cursor-pointer"
                          title="Inject backlink"
                        >
                          <Link size={12} />
                        </button>
                      )
                    )}
                    {s.exists && s.isSymlink && file.supportsBacklink && (
                      <button
                        onClick={() => {
                          migrateSymlink.mutate(file.filename);
                          toast.info('Migrating symlink...');
                        }}
                        className="p-1.5 rounded text-text-tertiary hover:text-accent hover:bg-bg-hover transition-colors cursor-pointer"
                        title="Migrate symlink"
                      >
                        <ArrowRightLeft size={12} />
                      </button>
                    )}
                    {!s.exists && file.supportsBacklink && (
                      <button
                        onClick={() => {
                          createFile.mutate(file.filename);
                          toast.success('File created');
                        }}
                        className="p-1.5 rounded text-text-tertiary hover:text-accent hover:bg-bg-hover transition-colors cursor-pointer"
                        title="Create file"
                      >
                        <Plus size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* ── .claude/ Directory section (read-only, informational) ── */}
            {claudeSettings && <ClaudeSettingsSection claudeSettings={claudeSettings} />}

            {/* ── Verify Backlinks section ── */}
            <div className="mt-3 pt-3 border-t border-border-subtle/50">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={verifyBacklinks}
                  disabled={isVerifying}
                  className="h-7 px-2 text-xs gap-1.5 cursor-pointer"
                >
                  {isVerifying ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Shield size={13} />
                  )}
                  Verify Backlinks
                </Button>
              </div>

              {/* Verification results */}
              {verificationResult && verificationResult.issues.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {verificationResult.issues.map((issue, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-md bg-bg-deep/50 border border-border-subtle/50 text-xs"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-text-primary font-mono">{issue.file}</span>
                        <SeverityBadge severity={issue.severity} />
                      </div>
                      <p className="text-text-secondary leading-relaxed">{issue.issue}</p>
                      {issue.suggestion && (
                        <div className="flex items-start gap-1.5 mt-1 text-text-tertiary">
                          <Info size={11} className="mt-0.5 shrink-0" />
                          <span>{issue.suggestion}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {verificationResult && verificationResult.issues.length === 0 && (
                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle size={13} />
                  <span>All backlinks verified — no issues found.</span>
                </div>
              )}
            </div>

            {/* ── Backlink Config section (collapsible) ── */}
            <div className="mt-3 pt-3 border-t border-border-subtle/50">
              <button
                onClick={() => setConfigOpen(!configOpen)}
                className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer w-full"
              >
                {configOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span className="font-medium">Backlink Configuration</span>
              </button>

              {configOpen && (
                <div className="mt-2 flex flex-col gap-3">
                  {!backlinkConfigLoaded ? (
                    <div className="flex items-center gap-2 text-xs text-text-tertiary py-2">
                      <Loader2 size={13} className="animate-spin" />
                      Loading config...
                    </div>
                  ) : (
                    <>
                      {/* Custom message */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-text-tertiary font-medium uppercase tracking-wider">
                          Custom message
                        </label>
                        <Textarea
                          value={editCustomMessage}
                          onChange={(e) => setEditCustomMessage(e.target.value)}
                          placeholder="Optional message injected into backlinks..."
                          className="min-h-[60px] text-xs font-mono bg-bg-deep border-border-subtle text-text-primary resize-y"
                          rows={3}
                        />
                      </div>

                      {/* Additional refs */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-text-tertiary font-medium uppercase tracking-wider">
                          Additional refs (comma-separated)
                        </label>
                        <Input
                          value={editAdditionalRefs}
                          onChange={(e) => setEditAdditionalRefs(e.target.value)}
                          placeholder="e.g., CONTRIBUTING.md, docs/API.md"
                          className="text-xs font-mono bg-bg-deep border-border-subtle text-text-primary"
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleSaveConfig}
                          className="h-7 px-2 text-xs gap-1.5 cursor-pointer"
                        >
                          <Save size={13} />
                          Save Config
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleUpdateAll}
                          disabled={updateAllBacklinks.isPending}
                          className="h-7 px-2 text-xs gap-1.5 cursor-pointer"
                        >
                          {updateAllBacklinks.isPending ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <RefreshCw size={13} />
                          )}
                          Update All Backlinks
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
