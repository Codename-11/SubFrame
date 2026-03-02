/**
 * Structure Map component.
 * D3.js force-directed graph visualization of project modules.
 * React owns the container div; D3 owns everything inside it.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, GitGraph, TreePine, Loader2, Search, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { useProjectStore } from '../stores/useProjectStore';
import { IPC } from '../../shared/ipcChannels';
import { typedInvoke } from '../lib/ipc';

// Access D3 from global (loaded via CDN in index.html).
// Lazy getter — the CDN script may load after our bundle executes.
function getD3(): any {
  return (window as any).d3;
}

// Module type colors matching the original
const MODULE_COLORS: Record<string, string> = {
  main: '#d4a574',     // Accent - main process
  renderer: '#78a5d4', // Info blue - renderer process
  shared: '#7cb382',   // Success green - shared modules
  external: '#6b6660', // Muted - external deps
};

interface StructureMapProps {
  open: boolean;
  onClose: () => void;
  /** When true, render inline without Dialog wrapper (for TerminalArea full-view) */
  inline?: boolean;
}

interface ModuleNode {
  id: string;
  name: string;
  fullName: string;
  type: string;
  file?: string;
  description?: string;
  exports?: string[];
  functions?: Record<string, unknown>;
  ipc?: { listens?: string[]; emits?: string[] };
  loc?: number;
  // D3 simulation properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface ModuleLink {
  source: string | ModuleNode;
  target: string | ModuleNode;
  type: string;
  channel?: string;
}

type ViewMode = 'graph' | 'tree';
type LinkMode = 'deps' | 'ipc' | 'both';

export function StructureMap({ open, onClose, inline = false }: StructureMapProps) {
  const svgRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<any>(null);
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [linkMode, setLinkMode] = useState<LinkMode>('deps');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<ModuleNode | null>(null);
  const [structureData, setStructureData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Apply search filter: highlight matching nodes, dim non-matching ones
  useEffect(() => {
    const d3 = getD3();
    if (!svgRef.current || !d3 || !structureData) return;
    const svg = d3.select(svgRef.current).select('svg');
    if (svg.empty()) return;

    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      // Reset all nodes to full opacity
      svg.selectAll('g g g').style('opacity', 1);
      return;
    }

    // Select all node groups (circles + text for graph, rects + text for tree)
    svg.selectAll('g g g').each(function (this: SVGElement, d: any) {
      const node = d3.select(this);
      // For graph view, d is the ModuleNode directly
      // For tree view, d is a hierarchy node with d.data
      const name: string = d?.name || d?.data?.name || d?.fullName || d?.data?.fullName || '';
      const fullName: string = d?.fullName || d?.data?.fullName || d?.id || d?.data?.id || '';
      const matches = name.toLowerCase().includes(query) || fullName.toLowerCase().includes(query);
      node.style('opacity', matches ? 1 : 0.15);
    });
  }, [searchQuery, structureData]);

  // Export SVG handler
  const handleExportSVG = useCallback(() => {
    if (!svgRef.current) return;
    const svgElement = svgRef.current.querySelector('svg');
    if (!svgElement) return;

    // Clone and add XML namespace for standalone SVG
    const clone = svgElement.cloneNode(true) as SVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'structure-map.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Load structure data when opened
  useEffect(() => {
    if (!open || !currentProjectPath) return;

    setIsLoading(true);
    setSelectedModule(null);
    setSearchQuery('');

    typedInvoke(IPC.LOAD_OVERVIEW, currentProjectPath)
      .then((overview) => {
        setStructureData(overview?.structure ?? null);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [open, currentProjectPath]);

  // Render D3 visualization when data or view mode changes
  useEffect(() => {
    const d3 = getD3();
    if (!open || !structureData || !svgRef.current || isLoading || !d3) return;

    // Clean up previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }

    // Clear the container — D3 owns everything inside
    svgRef.current.innerHTML = '';

    if (viewMode === 'graph') {
      renderForceGraph(svgRef.current, structureData, simulationRef, setSelectedModule, linkMode);
    } else {
      renderTreeView(svgRef.current, structureData, setSelectedModule);
    }

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [open, structureData, viewMode, linkMode, isLoading]);

  /** Shared toolbar: search + view toggle + legend + export (used in both dialog and inline modes) */
  const toolbar = (
    <div className="flex items-center gap-2">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter modules..."
          className="h-6 w-36 pl-6 pr-2 text-[11px] rounded-md bg-bg-deep border border-border-subtle text-text-primary
                     placeholder:text-text-muted outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* View toggle */}
      <div className="flex rounded-md border border-border-subtle overflow-hidden">
        <button
          onClick={() => setViewMode('graph')}
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] transition-colors cursor-pointer
            ${viewMode === 'graph' ? 'bg-bg-hover text-text-primary' : 'text-text-tertiary hover:text-text-secondary'}
          `}
        >
          <GitGraph className="w-3 h-3" />
          Graph
        </button>
        <button
          onClick={() => setViewMode('tree')}
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] transition-colors cursor-pointer
            ${viewMode === 'tree' ? 'bg-bg-hover text-text-primary' : 'text-text-tertiary hover:text-text-secondary'}
          `}
        >
          <TreePine className="w-3 h-3" />
          Tree
        </button>
      </div>

      {/* Link mode toggle — only in graph view */}
      {viewMode === 'graph' && (
        <div className="flex rounded-md border border-border-subtle overflow-hidden">
          {(['deps', 'ipc', 'both'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setLinkMode(mode)}
              className={`px-2 py-1 text-[11px] transition-colors cursor-pointer
                ${linkMode === mode ? 'bg-bg-hover text-text-primary' : 'text-text-tertiary hover:text-text-secondary'}
              `}
            >
              {mode === 'deps' ? 'Deps' : mode === 'ipc' ? 'IPC' : 'Both'}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
        {Object.entries(MODULE_COLORS).slice(0, 3).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ background: color }}
            />
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        ))}
        {viewMode === 'graph' && linkMode !== 'deps' && (
          <span className="flex items-center gap-1">
            <span className="w-4 h-0 inline-block border-t-2 border-dashed" style={{ borderColor: '#d4a574' }} />
            IPC
          </span>
        )}
      </div>

      {/* Download SVG */}
      {structureData && !isLoading && (
        <button
          onClick={handleExportSVG}
          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-border-subtle
                     text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
          title="Download SVG"
        >
          <Download className="w-3 h-3" />
          SVG
        </button>
      )}
    </div>
  );

  /** Shared canvas content: loading, empty, or D3 viz + info panel */
  const canvas = (
    <div className="flex-1 min-h-0 flex flex-col">
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-text-tertiary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Loading structure...</span>
        </div>
      ) : !structureData ? (
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">
          No structure data found. Run <code className="font-mono text-accent">npm run structure</code> first.
        </div>
      ) : (
        <>
          <div
            ref={svgRef}
            className="flex-1 min-h-[400px] bg-bg-deep"
          />

          {/* Info panel */}
          <ScrollArea className="h-[140px] border-t border-border-subtle bg-bg-primary px-4 py-3">
            {selectedModule ? (
              <ModuleInfoPanel module={selectedModule} />
            ) : (
              <div className="h-full flex items-center justify-center text-text-tertiary text-xs">
                Click on a module to see details
              </div>
            )}
          </ScrollArea>
        </>
      )}
    </div>
  );

  // Inline mode — render directly without Dialog wrapper (TerminalArea provides its own header)
  if (inline) {
    if (!open) return null;
    return (
      <div className="flex flex-col h-full">
        {/* Inline toolbar row */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle shrink-0 bg-bg-secondary">
          {toolbar}
        </div>
        {canvas}
      </div>
    );
  }

  // Dialog mode — original behavior
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="bg-bg-primary border-border-subtle sm:max-w-5xl max-h-[90vh] flex flex-col gap-0 p-0"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b border-border-subtle flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-sm font-medium">Project Structure Map</DialogTitle>
              <DialogDescription className="text-[10px] text-text-muted mt-0.5">
                Interactive visualization of project modules and dependencies
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {toolbar}

              {/* Close */}
              <button
                onClick={onClose}
                className="p-1 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Canvas */}
        {canvas}
      </DialogContent>
    </Dialog>
  );
}

/** Info panel for selected module */
function ModuleInfoPanel({ module }: { module: ModuleNode }) {
  const functionCount = module.functions ? Object.keys(module.functions).length : 0;
  const exportCount = module.exports?.length ?? 0;
  const hasIpc = module.ipc && ((module.ipc.listens?.length ?? 0) > 0 || (module.ipc.emits?.length ?? 0) > 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
          style={{ background: MODULE_COLORS[module.type], color: '#0f0f10' }}
        >
          {module.type}
        </span>
        <span className="text-xs font-medium text-text-primary font-mono">{module.fullName}</span>
        {module.file && (
          <span className="text-[10px] text-text-muted ml-auto font-mono">{module.file}</span>
        )}
      </div>

      <div className="flex gap-6 text-[11px]">
        {module.loc != null && (
          <div>
            <span className="text-text-tertiary">LOC:</span>{' '}
            <span className="text-text-primary">{module.loc.toLocaleString()}</span>
          </div>
        )}
        <div>
          <span className="text-text-tertiary">Functions:</span>{' '}
          <span className="text-text-primary">{functionCount}</span>
        </div>
        <div>
          <span className="text-text-tertiary">Exports:</span>{' '}
          <span className="text-text-primary">{exportCount}</span>
        </div>
        {hasIpc && (
          <div>
            <span className="text-text-tertiary">IPC:</span>{' '}
            <span className="text-text-primary">
              {module.ipc!.listens?.length ?? 0} in / {module.ipc!.emits?.length ?? 0} out
            </span>
          </div>
        )}
      </div>

      {exportCount > 0 && (
        <div className="flex flex-wrap gap-1">
          {module.exports!.slice(0, 8).map((exp) => (
            <span
              key={exp}
              className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-secondary font-mono"
            >
              {exp}
            </span>
          ))}
          {exportCount > 8 && (
            <span className="text-[10px] text-text-muted">+{exportCount - 8} more</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── D3 rendering functions ─────────────────────────────────────────────────

/** Convert STRUCTURE.json data to graph nodes and links */
function structureToGraph(data: any, linkMode: LinkMode = 'deps'): { nodes: ModuleNode[]; links: ModuleLink[] } {
  const nodes: ModuleNode[] = [];
  const links: ModuleLink[] = [];
  const nodeMap = new Map<string, ModuleNode>();

  if (!data?.modules) return { nodes, links };

  for (const [moduleId, moduleData] of Object.entries(data.modules) as [string, any][]) {
    let type = 'shared';
    if (moduleId.startsWith('main/')) type = 'main';
    else if (moduleId.startsWith('renderer/')) type = 'renderer';

    const node: ModuleNode = {
      id: moduleId,
      name: moduleId.split('/').pop()!,
      fullName: moduleId,
      type,
      file: moduleData.file,
      description: moduleData.description,
      exports: moduleData.exports || [],
      functions: moduleData.functions || {},
      ipc: moduleData.ipc || {},
      loc: moduleData.loc,
    };

    nodes.push(node);
    nodeMap.set(moduleId, node);
  }

  // Dependency links
  if (linkMode === 'deps' || linkMode === 'both') {
    for (const [moduleId, moduleData] of Object.entries(data.modules) as [string, any][]) {
      if (!moduleData.depends) continue;

      for (const dep of moduleData.depends) {
        let targetId = dep;
        if (!nodeMap.has(targetId)) {
          if (nodeMap.has(`main/${dep}`)) targetId = `main/${dep}`;
          else if (nodeMap.has(`renderer/${dep}`)) targetId = `renderer/${dep}`;
          else if (nodeMap.has(`shared/${dep}`)) targetId = `shared/${dep}`;
        }
        if (nodeMap.has(targetId)) {
          links.push({ source: moduleId, target: targetId, type: 'depends' });
        }
      }
    }
  }

  // IPC links: connect emitters to listeners on the same channel
  if (linkMode === 'ipc' || linkMode === 'both') {
    // Build listener map: channel → modules that listen
    const listenerMap = new Map<string, string[]>();
    for (const [moduleId, moduleData] of Object.entries(data.modules) as [string, any][]) {
      const listens = moduleData.ipc?.listens || [];
      for (const channel of listens) {
        if (!listenerMap.has(channel)) listenerMap.set(channel, []);
        listenerMap.get(channel)!.push(moduleId);
      }
    }

    // For each emitter, connect to all listeners of that channel
    for (const [moduleId, moduleData] of Object.entries(data.modules) as [string, any][]) {
      const emits = moduleData.ipc?.emits || [];
      for (const channel of emits) {
        const listeners = listenerMap.get(channel) || [];
        for (const listenerId of listeners) {
          if (listenerId !== moduleId) {
            links.push({ source: moduleId, target: listenerId, type: 'ipc', channel });
          }
        }
      }
    }
  }

  return { nodes, links };
}

/** Compute node radius from LOC (with fallback to export/function count) */
function nodeRadius(d: any): number {
  if (d.loc != null && d.loc > 0) {
    return Math.max(10, Math.min(35, Math.sqrt(d.loc) * 1.2));
  }
  const size = Object.keys(d.functions || {}).length + (d.exports?.length || 0);
  return Math.max(12, Math.min(25, 8 + size));
}

/** Render force-directed graph using D3 */
function renderForceGraph(
  container: HTMLDivElement,
  structureData: any,
  simulationRef: React.MutableRefObject<any>,
  onSelect: (module: ModuleNode | null) => void,
  linkMode: LinkMode = 'deps'
) {
  const d3 = getD3();
  if (!d3) return;

  const width = container.clientWidth;
  const height = container.clientHeight;
  const graph = structureToGraph(structureData, linkMode);

  if (graph.nodes.length === 0) return;

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g');

  // Zoom
  const zoom = d3.zoom()
    .scaleExtent([0.2, 4])
    .on('zoom', (event: any) => g.attr('transform', event.transform));
  svg.call(zoom);

  const defs = svg.append('defs');

  // Arrow marker for dependency links
  defs.append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .append('path')
    .attr('d', 'M 0,-5 L 10,0 L 0,5')
    .attr('fill', 'rgba(255,255,255,0.12)');

  // Arrow marker for IPC links (amber)
  defs.append('marker')
    .attr('id', 'arrowhead-ipc')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .append('path')
    .attr('d', 'M 0,-5 L 10,0 L 0,5')
    .attr('fill', '#d4a574');

  // Simulation — use LOC-based collision radius
  const simulation = d3.forceSimulation(graph.nodes)
    .force('link', d3.forceLink(graph.links).id((d: any) => d.id).distance(120).strength(0.5))
    .force('charge', d3.forceManyBody().strength(-400).distanceMax(400))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius((d: any) => nodeRadius(d) + 8));

  simulationRef.current = simulation;

  // Links — styled by type
  const link = g.append('g')
    .selectAll('line')
    .data(graph.links)
    .enter()
    .append('line')
    .attr('stroke', (d: any) => d.type === 'ipc' ? '#d4a574' : 'rgba(255,255,255,0.08)')
    .attr('stroke-width', (d: any) => d.type === 'ipc' ? 1.5 : 1.5)
    .attr('stroke-dasharray', (d: any) => d.type === 'ipc' ? '4,3' : 'none')
    .attr('stroke-opacity', (d: any) => d.type === 'ipc' ? 0.7 : 1)
    .attr('marker-end', (d: any) => d.type === 'ipc' ? 'url(#arrowhead-ipc)' : 'url(#arrowhead)');

  // Node groups
  const node = g.append('g')
    .selectAll('g')
    .data(graph.nodes)
    .enter()
    .append('g')
    .style('cursor', 'pointer')
    .call(d3.drag()
      .on('start', (event: any, d: any) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event: any, d: any) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event: any, d: any) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      })
    );

  // Circles — LOC-based sizing
  node.append('circle')
    .attr('r', (d: any) => nodeRadius(d))
    .attr('fill', (d: any) => MODULE_COLORS[d.type] || MODULE_COLORS.shared)
    .attr('stroke', '#0f0f10')
    .attr('stroke-width', 2);

  // Labels
  node.append('text')
    .attr('dy', 4)
    .attr('text-anchor', 'middle')
    .attr('fill', '#e8e6e3')
    .attr('font-size', '10px')
    .attr('font-family', "'DM Sans', sans-serif")
    .attr('pointer-events', 'none')
    .text((d: any) => d.name);

  // Interactions
  node.on('click', (_event: any, d: ModuleNode) => {
    onSelect(d);
  });

  node.on('mouseover', function (this: SVGElement, _event: any, d: ModuleNode) {
    d3.select(this).select('circle').attr('stroke', MODULE_COLORS[d.type] || '#fff').attr('stroke-width', 3);
  });

  node.on('mouseout', function (this: SVGElement) {
    d3.select(this).select('circle').attr('stroke', '#0f0f10').attr('stroke-width', 2);
  });

  // Tick
  simulation.on('tick', () => {
    link
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);

    node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
  });

  // Zoom to fit after settling
  setTimeout(() => {
    const bounds = g.node()?.getBBox();
    if (!bounds) return;
    const scale = 0.8 / Math.max(bounds.width / width, bounds.height / height);
    const midX = bounds.x + bounds.width / 2;
    const midY = bounds.y + bounds.height / 2;
    const translate = [width / 2 - scale * midX, height / 2 - scale * midY];

    svg.transition()
      .duration(750)
      .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
  }, 500);
}

/** Render hierarchical tree view using D3 */
function renderTreeView(
  container: HTMLDivElement,
  structureData: any,
  onSelect: (module: ModuleNode | null) => void
) {
  const d3 = getD3();
  if (!d3) return;

  const width = container.clientWidth;
  const height = container.clientHeight;

  // Build hierarchy
  const hierarchyData = buildHierarchy(structureData);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g');

  // Zoom
  const zoom = d3.zoom()
    .scaleExtent([0.2, 3])
    .on('zoom', (event: any) => g.attr('transform', event.transform));
  svg.call(zoom);

  // Tree layout
  const treeLayout = d3.tree()
    .nodeSize([160, 100])
    .separation((a: any, b: any) => (a.parent === b.parent ? 1 : 1.2));

  const root = d3.hierarchy(hierarchyData);
  treeLayout(root);

  // Links
  const linkGenerator = d3.linkVertical().x((d: any) => d.x).y((d: any) => d.y);

  g.append('g')
    .selectAll('path')
    .data(root.links())
    .enter()
    .append('path')
    .attr('d', linkGenerator as any)
    .attr('fill', 'none')
    .attr('stroke', (d: any) => MODULE_COLORS[d.target.data.type] || 'rgba(255,255,255,0.06)')
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.5);

  // Nodes
  const nodes = g.append('g')
    .selectAll('g')
    .data(root.descendants())
    .enter()
    .append('g')
    .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

  // Root node
  nodes.filter((d: any) => d.depth === 0)
    .append('rect')
    .attr('x', -60).attr('y', -20).attr('width', 120).attr('height', 40).attr('rx', 6)
    .attr('fill', '#1a1a1c').attr('stroke', '#d4a574').attr('stroke-width', 2);

  nodes.filter((d: any) => d.depth === 0)
    .append('text')
    .attr('text-anchor', 'middle').attr('dy', 4)
    .attr('fill', '#d4a574').attr('font-size', '12px').attr('font-weight', '600')
    .text((d: any) => d.data.name);

  // Group nodes (depth 1)
  const groupNodes = nodes.filter((d: any) => d.depth === 1);

  groupNodes.append('rect')
    .attr('x', -55).attr('y', -18).attr('width', 110).attr('height', 36).attr('rx', 5)
    .attr('fill', '#28282c')
    .attr('stroke', (d: any) => MODULE_COLORS[d.data.type] || 'rgba(255,255,255,0.06)')
    .attr('stroke-width', 1.5);

  groupNodes.append('text')
    .attr('text-anchor', 'middle').attr('dy', 4)
    .attr('fill', '#e8e6e3').attr('font-size', '11px').attr('font-weight', '500')
    .text((d: any) => d.data.label);

  // Module nodes (depth 2)
  const moduleNodes = nodes.filter((d: any) => d.depth === 2);

  moduleNodes.append('rect')
    .attr('x', -55).attr('y', -16).attr('width', 110).attr('height', 32).attr('rx', 4)
    .attr('fill', '#151516')
    .attr('stroke', (d: any) => MODULE_COLORS[d.data.type] || 'rgba(255,255,255,0.06)')
    .attr('stroke-width', 1).attr('stroke-opacity', 0.6);

  moduleNodes.append('text')
    .attr('text-anchor', 'middle').attr('dy', 3)
    .attr('fill', '#e8e6e3').attr('font-size', '10px')
    .attr('font-family', "'JetBrains Mono', monospace")
    .text((d: any) => {
      const n = d.data.name;
      return n.length > 14 ? n.substring(0, 12) + '...' : n;
    });

  // Module click
  moduleNodes.style('cursor', 'pointer')
    .on('click', (_event: any, d: any) => {
      if (d.data.moduleData) {
        onSelect(d.data.moduleData);
      }
    })
    .on('mouseover', function (this: SVGElement) {
      d3.select(this).select('rect')
        .attr('stroke-opacity', 1).attr('stroke-width', 2).attr('fill', '#28282c');
    })
    .on('mouseout', function (this: SVGElement) {
      d3.select(this).select('rect')
        .attr('stroke-opacity', 0.6).attr('stroke-width', 1).attr('fill', '#151516');
    });

  // Click on background to deselect
  svg.on('click', () => onSelect(null));

  // Zoom to fit
  setTimeout(() => {
    const bounds = g.node()?.getBBox();
    if (!bounds) return;
    const scale = 0.85 / Math.max(bounds.width / width, bounds.height / height);
    const midX = bounds.x + bounds.width / 2;
    const midY = bounds.y + bounds.height / 2;
    const translate = [width / 2 - scale * midX, height / 2 - scale * midY];

    svg.transition()
      .duration(750)
      .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(Math.min(scale, 1.2)));
  }, 100);
}

/** Build D3 hierarchy from STRUCTURE.json data */
function buildHierarchy(data: any) {
  const groups: Record<string, any[]> = { main: [], renderer: [], shared: [] };

  if (data?.modules) {
    for (const [moduleId, moduleData] of Object.entries(data.modules) as [string, any][]) {
      let type = 'shared';
      if (moduleId.startsWith('main/')) type = 'main';
      else if (moduleId.startsWith('renderer/')) type = 'renderer';

      groups[type].push({
        id: moduleId,
        name: moduleId.split('/').pop(),
        fullName: moduleId,
        type,
        file: moduleData.file,
        exports: moduleData.exports || [],
        functions: moduleData.functions || {},
        ipc: moduleData.ipc || {},
      });
    }
  }

  Object.values(groups).forEach((group) => group.sort((a, b) => a.name.localeCompare(b.name)));

  const typeLabels: Record<string, string> = {
    main: 'Main Process',
    renderer: 'Renderer',
    shared: 'Shared',
  };

  return {
    name: 'SubFrame',
    nodeType: 'root',
    children: ['main', 'renderer', 'shared'].map((type) => ({
      name: typeLabels[type],
      label: typeLabels[type],
      nodeType: 'group',
      type,
      children: groups[type].map((mod) => ({
        name: mod.name,
        nodeType: 'module',
        type: mod.type,
        id: mod.id,
        moduleData: mod,
      })),
    })),
  };
}
