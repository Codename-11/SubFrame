/**
 * OverviewPanel — Dashboard view with project stats cards.
 * Uses Framer Motion stagger animation on mount.
 */

import { motion } from 'framer-motion';
import { Folder, CheckCircle, FileText, BarChart3, RefreshCw, ArrowRight, AlertTriangle, XCircle, ListTodo, Heart, Clock, Settings2, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import { useOverview } from '../hooks/useOverview';
import { useTasks } from '../hooks/useTasks';
import { useAIFiles } from '../hooks/useAIFiles';
import { useSubFrameHealth } from '../hooks/useSubFrameHealth';
import { useProjectStore } from '../stores/useProjectStore';
import { useUIStore } from '../stores/useUIStore';
import type { OverviewData, OverviewTasks, OverviewStructure, OverviewDecisions, OverviewStats, AIFilesStatus, SubFrameHealthStatus, Task, RecentFile } from '../../shared/ipcChannels';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

interface OverviewPanelProps {
  /** When true, the panel is rendered inside TerminalArea full-view — skip own header */
  isFullView?: boolean;
}

export function OverviewPanel({ isFullView = false }: OverviewPanelProps) {
  const projectPath = useProjectStore((s) => s.currentProjectPath);
  const { overview, isLoading, refetch } = useOverview();
  const { tasks, grouped, isLoading: tasksLoading } = useTasks();
  const { status: aiFilesStatus, isLoading: aiFilesLoading } = useAIFiles();
  const { health: healthStatus, isLoading: healthLoading } = useSubFrameHealth();
  const togglePanel = useUIStore((s) => s.togglePanel);
  const toggleFullView = useUIStore((s) => s.toggleFullView);
  const setFullViewContent = useUIStore((s) => s.setFullViewContent);
  const setEditorFilePath = useUIStore((s) => s.setEditorFilePath);

  if (!projectPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-sm gap-1">
        <span>No project selected</span>
      </div>
    );
  }

  const data = overview as OverviewData | null;

  return (
    <div className="flex flex-col h-full">
      {/* Header — hidden in full-view mode (TerminalArea provides its own) */}
      {!isFullView && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
          <div>
            <div className="text-xs font-medium text-text-primary">
              {data?.projectName || 'Project Overview'}
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-7 px-2 cursor-pointer">
            <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        {isLoading && !data ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-sm gap-1">
            <span>No overview data available</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-3">
            <StatsHero
              data={data?.stats}
              onRefresh={refetch}
              isRefreshing={isLoading}
              onClick={() => setFullViewContent('stats')}
            />
            {/* Project cards */}
            <motion.div
              className={cn(
                'grid gap-2',
                isFullView ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'
              )}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <ProgressCard
                data={data?.tasks}
                onClick={() => toggleFullView('tasks')}
              />
              <StructureCard
                data={data?.structure}
                onClick={() => setFullViewContent('structureMap')}
              />
              <TasksCard
                grouped={grouped}
                totalCount={tasks.length}
                isFullView={isFullView}
                isLoading={tasksLoading}
                onViewAll={() => toggleFullView('tasks')}
              />
              <RecentFilesCard
                files={data?.recentFiles}
                isLoading={isLoading}
                onFileClick={(file) => setEditorFilePath(`${projectPath}/${file}`)}
              />
              <DecisionsCard data={data?.decisions} onClick={() => setFullViewContent('decisions')} />
            </motion.div>

            {/* SubFrame section */}
            <div className="flex items-center gap-2 mt-2 mb-0.5 px-0.5">
              <Settings2 size={12} className="text-text-muted" />
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">SubFrame</span>
              <div className="flex-1 h-px bg-border-subtle" />
            </div>
            <motion.div
              className={cn(
                'grid gap-2',
                isFullView ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'
              )}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <HealthCard
                health={healthStatus}
                isLoading={healthLoading}
                onClick={() => togglePanel('subframeHealth')}
              />
              <AIFilesCard
                status={aiFilesStatus}
                isLoading={aiFilesLoading}
                onClick={() => togglePanel('aiFiles')}
              />
            </motion.div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function CardLoader() {
  return (
    <div className="flex items-center justify-center py-3">
      <Loader2 size={14} className="animate-spin text-text-muted" />
    </div>
  );
}

function StructureCard({ data, onClick }: { data?: OverviewStructure; onClick?: () => void }) {
  const totalModules = data?.totalModules || 0;
  const ipcChannels = data?.ipcChannels || 0;
  const groups = data?.groups || [];

  return (
    <motion.div variants={cardVariants} className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 cursor-pointer hover:border-accent/30 transition-colors" onClick={onClick}>
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <Folder size={14} className="text-accent" />
          <span className="text-xs font-medium text-text-primary">Structure</span>
        </div>
        <div className="text-[10px] text-text-tertiary mt-0.5 ml-[22px]">Module map &amp; IPC channels</div>
      </div>
      {totalModules === 0 ? (
        <div className="text-[10px] text-text-tertiary">No STRUCTURE.json found</div>
      ) : (
        <>
          <div className="text-xl font-bold text-text-primary">{totalModules}</div>
          <div className="text-[10px] text-text-tertiary mb-2">modules</div>
          {groups.slice(0, 3).map((g) => (
            <div key={g.name} className="flex items-center justify-between text-[10px] text-text-secondary">
              <span>{g.name}/</span>
              <span className="text-text-tertiary">{g.count}</span>
            </div>
          ))}
          {ipcChannels > 0 && (
            <div className="text-[10px] text-text-tertiary mt-1">{ipcChannels} IPC channels</div>
          )}
        </>
      )}
    </motion.div>
  );
}

function ProgressCard({ data, onClick }: { data?: OverviewTasks; onClick?: () => void }) {
  const total = data?.total || 0;
  const completed = data?.completed || 0;
  const inProgress = data?.inProgress || 0;
  const pending = data?.pending || 0;
  const progress = data?.progress || 0;

  return (
    <motion.div variants={cardVariants} className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 cursor-pointer hover:border-accent/30 transition-colors" onClick={onClick}>
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <CheckCircle size={14} className="text-emerald-400" />
          <span className="text-xs font-medium text-text-primary">Progress</span>
        </div>
        <div className="text-[10px] text-text-tertiary mt-0.5 ml-[22px]">Sub-Task completion</div>
      </div>
      {total === 0 ? (
        <div className="text-[10px] text-text-tertiary">No tasks yet</div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-bg-hover mb-2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-text-secondary mb-1.5">
            {completed}/{total} tasks completed
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-emerald-400">{completed} done</span>
            <span className="text-amber-400">{inProgress} active</span>
            <span className="text-text-tertiary">{pending} pending</span>
          </div>
        </>
      )}
    </motion.div>
  );
}

function DecisionsCard({ data, onClick }: { data?: OverviewDecisions; onClick?: () => void }) {
  const total = data?.total || 0;
  const decisions = data?.decisions || [];

  return (
    <motion.div variants={cardVariants} className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 cursor-pointer hover:border-accent/30 transition-colors" onClick={onClick}>
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-blue-400" />
          <span className="text-xs font-medium text-text-primary">Decisions</span>
        </div>
        <div className="text-[10px] text-text-tertiary mt-0.5 ml-[22px]">From PROJECT_NOTES.md</div>
      </div>
      {total === 0 ? (
        <div className="text-[10px] text-text-tertiary">No decisions recorded</div>
      ) : (
        <>
          <div className="text-xl font-bold text-text-primary">{total}</div>
          <div className="text-[10px] text-text-tertiary mb-2">decisions recorded</div>
          {decisions.slice(0, 3).map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-text-secondary">
              <span className="text-text-tertiary shrink-0">{d.date}</span>
              <span className="truncate">{d.title}</span>
            </div>
          ))}
        </>
      )}
    </motion.div>
  );
}

function StatsHero({
  data,
  onRefresh,
  isRefreshing,
  onClick,
}: {
  data?: OverviewStats;
  onRefresh: () => void;
  isRefreshing: boolean;
  onClick: () => void;
}) {
  if (!data) {
    return (
      <motion.div variants={cardVariants} className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 cursor-pointer hover:border-accent/30 transition-colors" onClick={onClick}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={14} className="text-purple-400" />
            <span className="text-xs font-medium text-text-primary">Stats</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            className="h-6 w-6 p-0 cursor-pointer"
          >
            <RefreshCw size={12} className={cn(isRefreshing && 'animate-spin')} />
          </Button>
        </div>
        <div className="text-[10px] text-text-tertiary mt-1">No stats available</div>
      </motion.div>
    );
  }

  const linesOfCode = typeof data.linesOfCode === 'number' ? data.linesOfCode : data.linesOfCode?.total || 0;
  const fileCount = typeof data.fileCount === 'number' ? data.fileCount : data.fileCount?.total || 0;
  const git = data.git;

  return (
    <motion.div variants={cardVariants} className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 cursor-pointer hover:border-accent/30 transition-colors" onClick={onClick}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-purple-400" />
          <span className="text-xs font-medium text-text-primary">Stats</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onRefresh(); }}
          className="h-6 w-6 p-0 cursor-pointer"
        >
          <RefreshCw size={12} className={cn(isRefreshing && 'animate-spin')} />
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <div className="text-sm font-bold text-text-primary">{formatNumber(linesOfCode)}</div>
          <div className="text-[10px] text-text-tertiary">LOC</div>
        </div>
        <div>
          <div className="text-sm font-bold text-text-primary">{fileCount}</div>
          <div className="text-[10px] text-text-tertiary">Source Files</div>
        </div>
        <div>
          <div className="text-sm font-bold text-text-primary">{git ? git.commitCount : '—'}</div>
          <div className="text-[10px] text-text-tertiary">Commits</div>
        </div>
        <div>
          <div className="text-sm font-bold text-text-primary truncate">{git ? git.branch : '—'}</div>
          <div className="text-[10px] text-text-tertiary">Branch</div>
        </div>
      </div>
      {git?.lastCommit && (
        <div className="text-[10px] text-text-tertiary mt-2 truncate">
          Last: {git.lastCommit}
        </div>
      )}
    </motion.div>
  );
}

function TasksCard({
  grouped,
  totalCount,
  isFullView,
  isLoading,
  onViewAll,
}: {
  grouped: { pending: Task[]; inProgress: Task[]; completed: Task[] };
  totalCount: number;
  isFullView?: boolean;
  isLoading?: boolean;
  onViewAll: () => void;
}) {
  // Show in_progress first, then pending, up to 4 items
  const displayTasks = [...grouped.inProgress, ...grouped.pending].slice(0, 4);
  const remainingCount = totalCount - displayTasks.length;

  return (
    <motion.div
      variants={cardVariants}
      className={cn(
        'rounded-lg border border-border-subtle bg-bg-deep/50 p-3',
        !isFullView && 'col-span-2'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ListTodo size={14} className="text-accent" />
          <span className="text-xs font-medium text-text-primary">Active Tasks</span>
        </div>
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors cursor-pointer"
        >
          View All <ArrowRight size={10} />
        </button>
      </div>
      {isLoading && totalCount === 0 ? (
        <CardLoader />
      ) : displayTasks.length === 0 ? (
        <div className="text-[10px] text-text-tertiary">No active tasks</div>
      ) : (
        <>
          {displayTasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between gap-2 py-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    task.status === 'in_progress' ? 'bg-amber-400' : 'bg-zinc-500'
                  )}
                />
                <span className="text-[11px] text-text-secondary truncate">{task.title}</span>
              </div>
              <span
                className={cn(
                  'text-[10px] shrink-0',
                  task.priority === 'high' ? 'text-red-400' : 'text-text-tertiary'
                )}
              >
                {task.priority}
              </span>
            </div>
          ))}
          {remainingCount > 0 && (
            <div className="text-[10px] text-text-tertiary mt-1">+{remainingCount} more tasks</div>
          )}
        </>
      )}
    </motion.div>
  );
}

function AIFilesCard({ status, isLoading, onClick }: { status: AIFilesStatus | null; isLoading?: boolean; onClick: () => void }) {
  const files = [
    { label: 'CLAUDE.md', check: status?.claude, supportsBacklink: true },
    { label: 'GEMINI.md', check: status?.gemini, supportsBacklink: true },
    { label: 'AGENTS.md', check: status?.agents, supportsBacklink: false },
    { label: 'Codex', check: status?.codexWrapper, supportsBacklink: false },
  ];

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 cursor-pointer hover:border-accent/30 transition-colors"
      onClick={onClick}
    >
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-cyan-400" />
          <span className="text-xs font-medium text-text-primary">AI Files</span>
        </div>
        <div className="text-[10px] text-text-tertiary mt-0.5 ml-[22px]">Instruction files for AI tools</div>
      </div>
      {isLoading && !status ? (
        <CardLoader />
      ) : !status ? (
        <div className="text-[10px] text-text-tertiary">No data available</div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {files.map((f) => {
            const exists = f.check?.exists ?? false;
            // Only check backlink status for files that support backlinks (CLAUDE.md, GEMINI.md)
            const hasBacklink = (f.check as any)?.hasBacklink;
            const showWarning = exists && f.supportsBacklink && hasBacklink === false;

            return (
              <div key={f.label} className="flex items-center gap-2 text-[11px]">
                {!exists ? (
                  <XCircle size={12} className="text-zinc-500 shrink-0" />
                ) : showWarning ? (
                  <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                ) : (
                  <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                )}
                <span className={cn('truncate', exists ? 'text-text-secondary' : 'text-text-tertiary')}>
                  {f.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function HealthCard({ health, isLoading, onClick }: { health: SubFrameHealthStatus | null; isLoading?: boolean; onClick: () => void }) {
  const categories = ['core', 'hooks', 'skills', 'claude-integration', 'git'] as const;
  const categoryLabels: Record<string, string> = {
    core: 'Core',
    hooks: 'Hooks',
    skills: 'Skills',
    'claude-integration': 'Claude',
    git: 'Git',
  };

  const byCat = (cat: string) => health?.components.filter((c) => c.category === cat) || [];

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3 cursor-pointer hover:border-accent/30 transition-colors"
      onClick={onClick}
    >
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <Heart size={14} className={health && health.healthy === health.total ? 'text-emerald-400' : 'text-amber-400'} />
          <span className="text-xs font-medium text-text-primary">SubFrame Status</span>
        </div>
        <div className="text-[10px] text-text-tertiary mt-0.5 ml-[22px]">Component health &amp; updates</div>
      </div>
      {isLoading && !health ? (
        <CardLoader />
      ) : !health ? (
        <div className="text-[10px] text-text-tertiary">No data available</div>
      ) : (
        <>
          <div className="text-xl font-bold text-text-primary">{health.healthy}/{health.total}</div>
          <div className="text-[10px] text-text-tertiary mb-2">components healthy</div>
          {categories.map((cat) => {
            const comps = byCat(cat);
            if (comps.length === 0) return null;
            const allOk = comps.every((c) => c.exists && !c.needsUpdate);
            return (
              <div key={cat} className="flex items-center justify-between text-[10px]">
                <span className="text-text-secondary">{categoryLabels[cat]}</span>
                <span className={allOk ? 'text-emerald-400' : 'text-amber-400'}>
                  {comps.filter((c) => c.exists && !c.needsUpdate).length}/{comps.length}
                </span>
              </div>
            );
          })}
        </>
      )}
    </motion.div>
  );
}

function RecentFilesCard({ files, isLoading, onFileClick }: { files?: RecentFile[]; isLoading?: boolean; onFileClick: (file: string) => void }) {
  return (
    <motion.div
      variants={cardVariants}
      className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3"
    >
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-amber-400" />
          <span className="text-xs font-medium text-text-primary">Recent Files</span>
        </div>
        <div className="text-[10px] text-text-tertiary mt-0.5 ml-[22px]">Recently modified source files</div>
      </div>
      {isLoading && !files ? (
        <CardLoader />
      ) : !files || files.length === 0 ? (
        <div className="text-[10px] text-text-tertiary">No recent changes</div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {files.map((f) => {
            const basename = f.file.split('/').pop() || f.file;
            const timeAgo = getRelativeTime(f.modified);
            return (
              <button
                key={f.file}
                onClick={() => onFileClick(f.file)}
                className="flex items-center justify-between gap-2 text-[11px] text-left hover:bg-bg-hover rounded px-1 py-0.5 -mx-1 transition-colors cursor-pointer"
              >
                <span className="text-text-secondary truncate">{basename}</span>
                <span className="text-text-muted text-[10px] shrink-0">{timeAgo}</span>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function getRelativeTime(isoDate: string): string {
  if (!isoDate) return '';
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
