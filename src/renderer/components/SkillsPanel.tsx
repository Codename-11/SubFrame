/**
 * SkillsPanel — Shows all .claude/skills found in the project.
 * Each skill renders as an expandable card with command, description,
 * allowed tools, health status, and full SKILL.md content on expand.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, RefreshCw, Play, Zap, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';
import { useSkills } from '../hooks/useSkills';
import { useProjectStore } from '../stores/useProjectStore';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { MarkdownPreview } from './previews/MarkdownPreview';
import { cn } from '../lib/utils';
import type { SkillInfo } from '../../shared/ipcChannels';

/** Type the global terminalSendCommand helper */
declare global {
  interface Window {
    terminalSendCommand?: (command: string) => void;
  }
}

function HealthBadge({ status }: { status: SkillInfo['healthStatus'] }) {
  if (!status) return null;
  const config = {
    healthy: { label: 'Healthy', icon: ShieldCheck, className: 'text-success border-success/30 bg-success/10' },
    outdated: { label: 'Outdated', icon: AlertTriangle, className: 'text-warning border-warning/30 bg-warning/10' },
    missing: { label: 'Missing', icon: XCircle, className: 'text-error border-error/30 bg-error/10' },
  }[status];

  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border', config.className)}>
      <Icon size={10} />
      {config.label}
    </span>
  );
}

function SkillCard({ skill }: { skill: SkillInfo }) {
  const [expanded, setExpanded] = useState(false);

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window.terminalSendCommand === 'function') {
      window.terminalSendCommand(skill.command);
    }
  };

  return (
    <div className="border border-border-subtle rounded-lg bg-bg-secondary overflow-hidden">
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-3 text-left cursor-pointer hover:bg-bg-hover/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          {/* Command + argument hint */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-accent font-medium">{skill.command}</span>
            {skill.argumentHint && (
              <span className="font-mono text-xs text-text-muted">{skill.argumentHint}</span>
            )}
          </div>

          {/* Description */}
          <p className="text-xs text-text-secondary mt-1 line-clamp-2">{skill.description}</p>

          {/* Badges row */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {skill.healthStatus && <HealthBadge status={skill.healthStatus} />}
            {skill.disableModelInvocation && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-text-muted border-border-subtle">
                User-only
              </Badge>
            )}
            {skill.allowedTools.map((tool) => (
              <Badge key={tool} variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-text-tertiary border-border-subtle">
                {tool}
              </Badge>
            ))}
          </div>
        </div>

        {/* Right side — Run button + chevron */}
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          <button
            onClick={handleRun}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-accent bg-accent-subtle border border-accent/20 hover:bg-accent/20 transition-colors cursor-pointer"
            title={`Type ${skill.command} into terminal`}
          >
            <Play size={10} />
            Run
          </button>
          <ChevronDown
            size={14}
            className={cn(
              'text-text-muted transition-transform duration-200',
              expanded && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border-subtle max-h-80 overflow-y-auto scrollbar-thin">
              <MarkdownPreview content={skill.content} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SkillsPanel() {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const { skills, isLoading, refetch } = useSkills();

  if (!projectPath) {
    return (
      <div className="flex h-full items-center justify-center text-text-tertiary">
        <div className="text-center">
          <Zap size={24} className="mx-auto mb-2 text-text-muted" />
          <p className="text-xs">No project selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
        <span className="text-xs text-text-secondary">
          {isLoading ? 'Loading...' : `${skills.length} skill${skills.length !== 1 ? 's' : ''}`}
        </span>
        <button
          onClick={() => refetch()}
          className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
          title="Refresh skills"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {skills.length === 0 && !isLoading ? (
            <div className="text-center py-8">
              <Zap size={20} className="mx-auto mb-2 text-text-muted" />
              <p className="text-xs text-text-tertiary mb-1">No skills found</p>
              <p className="text-[10px] text-text-muted">.claude/skills/*/SKILL.md</p>
            </div>
          ) : (
            skills.map((skill) => <SkillCard key={skill.id} skill={skill} />)
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
