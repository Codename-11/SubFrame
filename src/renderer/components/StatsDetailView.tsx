import { useMemo, useRef, useState, useEffect } from 'react';
import { RefreshCw, BarChart3, GitBranch, FileCode, Code, Circle, CheckCircle2, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import { useOverview } from '../hooks/useOverview';
import { useGitBranches } from '../hooks/useGithub';
import type { DayActivity, GitBranch as GitBranchType } from '../../shared/ipcChannels';

function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function StatsDetailView() {
  const { overview, isLoading, refetch } = useOverview();
  const { branches, currentBranch } = useGitBranches();
  const stats = overview?.stats;

  const linesOfCode = stats
    ? typeof stats.linesOfCode === 'number'
      ? { total: stats.linesOfCode, byExtension: {} as Record<string, number> }
      : stats.linesOfCode
    : null;
  const fileCount = stats
    ? typeof stats.fileCount === 'number'
      ? stats.fileCount
      : stats.fileCount?.total || 0
    : 0;
  const git = stats?.git || null;

  // Sort extensions by line count descending
  const extensions = linesOfCode?.byExtension
    ? Object.entries(linesOfCode.byExtension).sort(([, a], [, b]) => b - a)
    : [];
  const maxExtLines = extensions.length > 0 ? extensions[0][1] : 0;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-5">
        {/* Header with refresh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-text-primary">Repository Statistics</h2>
          </div>
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-7 px-2 cursor-pointer">
            <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
          </Button>
        </div>

        {isLoading && !stats ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : !stats ? (
          <div className="text-sm text-text-tertiary text-center py-8">No statistics available for this project</div>
        ) : (
          <>
            {/* Summary metrics row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="Lines of Code" value={formatNumber(linesOfCode?.total || 0)} icon={<Code size={16} className="text-purple-400" />} />
              <MetricCard label="Source Files" value={String(fileCount)} icon={<FileCode size={16} className="text-blue-400" />} />
              <MetricCard label="Commits" value={git ? formatNumber(git.commitCount) : '—'} icon={<GitBranch size={16} className="text-emerald-400" />} />
              <MetricCard label="Branch" value={git?.branch || '—'} icon={<GitBranch size={16} className="text-amber-400" />} />
            </div>

            {/* Two-column: LOC breakdown + Git info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* LOC by Extension */}
              {extensions.length > 0 && (
                <div className="rounded-lg border border-border-subtle bg-bg-deep/50 p-4">
                  <h3 className="text-xs font-medium text-text-primary mb-3">Lines of Code by Extension</h3>
                  <div className="space-y-2">
                    {extensions.map(([ext, count]) => (
                      <div key={ext} className="flex items-center gap-3">
                        <span className="text-xs font-mono text-text-secondary w-12 text-right shrink-0">.{ext}</span>
                        <div className="flex-1 h-2 rounded-full bg-bg-hover overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent/70 transition-all"
                            style={{ width: `${(count / maxExtLines) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-tertiary tabular-nums w-16 text-right shrink-0">{formatNumber(count)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Git Info + Branches */}
              {git && (
                <div className="rounded-lg border border-border-subtle bg-bg-deep/50 p-4">
                  <h3 className="text-xs font-medium text-text-primary mb-3">Git Information</h3>
                  <div className="space-y-2">
                    <InfoRow label="Commits" value={formatNumber(git.commitCount)} />
                    <InfoRow label="Last Commit" value={git.lastCommit} />
                  </div>

                  {/* Branch listing — grouped by remote */}
                  {branches.length > 0 && (
                    <BranchGroups branches={branches} currentBranch={currentBranch} />
                  )}
                </div>
              )}
            </div>

            {/* Git Activity: heatmap + trend chart */}
            {git?.activity && Object.keys(git.activity).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <GitActivityGrid activity={git.activity} />
                <CommitActivityChart activity={git.activity} />
              </div>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
}

function GitActivityGrid({ activity }: { activity: Record<string, DayActivity> }) {
  // GitHub-style contribution graph — 1 year, cells scale to fill container
  const containerRef = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(0);
  const GAP = 2;
  const LABEL_W = 26;

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364);

  const weekStart = new Date(startDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const allDays: Array<{ date: string; count: number; authors: Record<string, number>; inRange: boolean }> = [];
  const cursor = new Date(weekStart);
  while (cursor <= today) {
    const dateStr = cursor.toISOString().split('T')[0];
    const day = activity[dateStr];
    const count = typeof day === 'number' ? day : day?.total || 0;
    const authors = (typeof day === 'object' && day?.authors) || {};
    allDays.push({ date: dateStr, count, authors, inRange: cursor >= startDate });
    cursor.setDate(cursor.getDate() + 1);
  }
  while (allDays.length % 7 !== 0) {
    allDays.push({ date: '', count: 0, authors: {}, inRange: false });
  }

  const maxCount = Math.max(...allDays.filter(d => d.inRange).map(d => d.count), 1);
  const numWeeks = Math.ceil(allDays.length / 7);
  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  const bgClasses = ['bg-bg-hover', 'bg-accent/25', 'bg-accent/50', 'bg-accent/75', 'bg-accent'];

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabels: string[] = [];
  for (let w = 0; w < numWeeks; w++) {
    const firstDay = allDays[w * 7];
    if (!firstDay?.date) { monthLabels.push(''); continue; }
    const month = monthNames[parseInt(firstDay.date.split('-')[1]) - 1];
    monthLabels.push(w === 0 || monthLabels[w - 1] !== month ? month : '');
  }

  // Measure container and compute cell size to fill width
  useEffect(() => {
    if (!containerRef.current) return;
    const measure = () => {
      const w = containerRef.current!.clientWidth;
      const available = w - LABEL_W - GAP;
      const size = Math.floor((available - GAP * (numWeeks - 1)) / numWeeks);
      setCell(Math.max(6, Math.min(size, 14)));
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [numWeeks]);

  return (
    <div ref={containerRef} className="rounded-lg border border-border-subtle bg-bg-deep/50 p-4">
      <h3 className="text-xs font-medium text-text-primary mb-3">Commit Activity</h3>

      {cell > 0 && (
        <>
          {/* Month labels */}
          <div className="flex mb-1" style={{ paddingLeft: LABEL_W + GAP }}>
            {monthLabels.map((label, i) => (
              <div key={i} className="shrink-0" style={{ width: cell, marginRight: i < numWeeks - 1 ? GAP : 0 }}>
                {label && <span className="text-[9px] text-text-muted whitespace-nowrap">{label}</span>}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex" style={{ gap: GAP }}>
            {/* Day labels */}
            <div className="flex flex-col shrink-0" style={{ width: LABEL_W, gap: GAP }}>
              {dayLabels.map((label, i) => (
                <div key={i} className="flex items-center justify-end" style={{ height: cell }}>
                  {label && <span className="text-[9px] text-text-muted leading-none">{label}</span>}
                </div>
              ))}
            </div>

            {/* Week columns */}
            {Array.from({ length: numWeeks }, (_, week) => (
              <div key={week} className="flex flex-col" style={{ gap: GAP }}>
                {Array.from({ length: 7 }, (_, day) => {
                  const cell_ = allDays[week * 7 + day];
                  if (!cell_ || !cell_.inRange) {
                    return <div key={day} style={{ width: cell, height: cell }} />;
                  }
                  const intensity = cell_.count === 0 ? 0 : Math.min(4, Math.ceil((cell_.count / maxCount) * 4));
                  const authorList = Object.entries(cell_.authors).sort(([,a],[,b]) => b - a).map(([name, n]) => `  ${name}: ${n}`).join('\n');
                  const tip = `${cell_.date}: ${cell_.count} commit${cell_.count !== 1 ? 's' : ''}${authorList ? '\n' + authorList : ''}`;
                  return (
                    <div
                      key={day}
                      className={cn('rounded-sm', bgClasses[intensity])}
                      style={{ width: cell, height: cell }}
                      title={tip}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[9px] text-text-muted">Less</span>
            {bgClasses.map((bg, i) => (
              <div key={i} className={cn('rounded-sm', bg)} style={{ width: 10, height: 10 }} />
            ))}
            <span className="text-[9px] text-text-muted">More</span>
          </div>
        </>
      )}
    </div>
  );
}

type ChartPeriod = '30d' | '90d' | '6m' | '1y';
const PERIODS: { value: ChartPeriod; label: string; days: number }[] = [
  { value: '30d', label: '30 days', days: 30 },
  { value: '90d', label: '3 months', days: 90 },
  { value: '6m', label: '6 months', days: 182 },
  { value: '1y', label: '1 year', days: 364 },
];

function CommitActivityChart({ activity }: { activity: Record<string, DayActivity> }) {
  const [period, setPeriod] = useState<ChartPeriod>('90d');
  const days = PERIODS.find(p => p.value === period)!.days;

  const chartData = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days);

    const weeks: Record<string, { commits: number; authors: Record<string, number> }> = {};
    const weekLabels: Record<string, string> = {};
    const cursor = new Date(startDate);

    while (cursor <= today) {
      const dateStr = cursor.toISOString().split('T')[0];
      const day = cursor.getDay();
      const monday = new Date(cursor);
      monday.setDate(monday.getDate() - ((day + 6) % 7));
      const weekKey = monday.toISOString().split('T')[0];

      if (!weeks[weekKey]) {
        weeks[weekKey] = { commits: 0, authors: {} };
        const month = monday.toLocaleDateString('en-US', { month: 'short' });
        const dayNum = monday.getDate();
        weekLabels[weekKey] = `${month} ${dayNum}`;
      }
      const dayData = activity[dateStr];
      if (dayData) {
        weeks[weekKey].commits += (typeof dayData === 'number' ? dayData : dayData.total) || 0;
        for (const [author, count] of Object.entries((typeof dayData === 'object' && dayData.authors) || {})) {
          weeks[weekKey].authors[author] = (weeks[weekKey].authors[author] || 0) + count;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => ({
        week,
        label: weekLabels[week],
        commits: data.commits,
        authors: data.authors,
      }));
  }, [activity, days]);

  const totalCommits = chartData.reduce((sum, d) => sum + d.commits, 0);
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#d4a574';

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-deep/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-text-primary">Commit Trend</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-tertiary">{totalCommits} commits</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as ChartPeriod)}
            className="text-[10px] bg-bg-hover border border-border-subtle rounded px-1.5 py-0.5 text-text-secondary cursor-pointer outline-none focus:border-accent/50"
          >
            {PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ left: -4, right: 8, top: 8, bottom: 4 }}
          >
            <defs>
              <linearGradient id="commitFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity={0.35} />
                <stop offset="100%" stopColor={accentColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}
              width={24}
              allowDecimals={false}
            />
            <Tooltip
              cursor={false}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                const authors = Object.entries(data.authors || {}).sort(([,a]: [string, any],[,b]: [string, any]) => b - a);
                return (
                  <div className="rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-[11px] shadow-xl">
                    <div className="font-medium text-text-primary mb-1">Week of {label}</div>
                    <div className="text-text-secondary">{data.commits} commit{data.commits !== 1 ? 's' : ''}</div>
                    {authors.length > 0 && (
                      <div className="mt-1.5 pt-1.5 border-t border-border-subtle space-y-0.5">
                        {authors.slice(0, 5).map(([name, count]) => (
                          <div key={name} className="flex items-center justify-between gap-3">
                            <span className="text-text-tertiary truncate">{name}</span>
                            <span className="text-text-secondary tabular-nums">{count as number}</span>
                          </div>
                        ))}
                        {authors.length > 5 && (
                          <div className="text-text-muted">+{authors.length - 5} more</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Area
              dataKey="commits"
              type="monotone"
              fill="url(#commitFill)"
              stroke={accentColor}
              strokeWidth={1.5}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Branch Groups ────────────────────────────────────────────────────────────

/** Max branches shown per group before "show more" truncation */
const BRANCH_GROUP_LIMIT = 8;

interface BranchGroupsProps {
  branches: GitBranchType[];
  currentBranch?: string;
}

function BranchGroups({ branches, currentBranch }: BranchGroupsProps) {
  // Group branches: local (remote=null), then by remote name
  const groups = useMemo(() => {
    const map = new Map<string, GitBranchType[]>();
    for (const b of branches) {
      const key = b.remote ?? 'local';
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    // Sort: local first, then origin, then alphabetical
    const sorted = [...map.entries()].sort(([a], [b]) => {
      if (a === 'local') return -1;
      if (b === 'local') return 1;
      if (a === 'origin') return -1;
      if (b === 'origin') return 1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [branches]);

  // Default collapsed state: upstream+ remotes start collapsed
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Auto-collapse newly discovered remote groups (preserves user-toggled state)
  useEffect(() => {
    setCollapsed(prev => {
      const next = { ...prev };
      let changed = false;
      for (const [key] of groups) {
        if (key !== 'local' && key !== 'origin' && !(key in next)) {
          next[key] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [groups]);

  // Track which groups have "show more" expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleCollapse = (key: string) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleExpand = (key: string) =>
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="mt-4 pt-3 border-t border-border-subtle">
      <h4 className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider mb-2">Branches</h4>
      <div className="space-y-2">
        {groups.map(([groupKey, groupBranches]) => {
          const isCollapsed = !!collapsed[groupKey];
          const isExpanded = !!expanded[groupKey];
          const label = groupKey === 'local' ? 'Local' : groupKey;
          const needsTruncation = groupBranches.length > BRANCH_GROUP_LIMIT;
          const visibleBranches = isExpanded || !needsTruncation
            ? groupBranches
            : groupBranches.slice(0, BRANCH_GROUP_LIMIT);
          const hiddenCount = groupBranches.length - BRANCH_GROUP_LIMIT;

          return (
            <div key={groupKey}>
              {/* Group header — clickable to collapse/expand */}
              <button
                onClick={() => toggleCollapse(groupKey)}
                className="flex items-center gap-1.5 w-full text-left group cursor-pointer mb-1"
              >
                {isCollapsed ? (
                  <ChevronRight size={12} className="text-text-muted shrink-0" />
                ) : (
                  <ChevronDown size={12} className="text-text-muted shrink-0" />
                )}
                <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
                  {label}
                </span>
                <span className="text-[10px] text-text-muted">
                  ({groupBranches.length})
                </span>
              </button>

              {/* Branch list */}
              {!isCollapsed && (
                <div className="space-y-1 ml-3.5">
                  {visibleBranches.map((branch) => {
                    const displayName = branch.remote
                      ? branch.name.replace(`${branch.remote}/`, '')
                      : branch.name;
                    const isMain = displayName === 'main' || displayName === 'master';
                    const isActive = branch.name === currentBranch;
                    return (
                      <div key={branch.name} className="flex items-center gap-2 text-xs">
                        {isActive ? (
                          <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                        ) : (
                          <Circle size={12} className="text-text-muted shrink-0" />
                        )}
                        <span className={cn(
                          'font-mono truncate',
                          isActive ? 'text-text-primary font-medium' : 'text-text-secondary'
                        )}>
                          {displayName}
                        </span>
                        {isMain && !branch.remote && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent shrink-0">default</span>
                        )}
                        {isActive && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 shrink-0">active</span>
                        )}
                      </div>
                    );
                  })}
                  {needsTruncation && !isExpanded && (
                    <button
                      onClick={() => toggleExpand(groupKey)}
                      className="text-[10px] text-accent hover:text-accent/80 cursor-pointer pl-5"
                    >
                      +{hiddenCount} more...
                    </button>
                  )}
                  {needsTruncation && isExpanded && (
                    <button
                      onClick={() => toggleExpand(groupKey)}
                      className="text-[10px] text-accent hover:text-accent/80 cursor-pointer pl-5"
                    >
                      Show less
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-deep/50 p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] text-text-tertiary uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-bold text-text-primary truncate">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-tertiary">{label}</span>
      <span className="text-text-secondary font-mono truncate ml-4">{value}</span>
    </div>
  );
}
