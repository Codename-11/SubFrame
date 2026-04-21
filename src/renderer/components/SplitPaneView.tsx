/**
 * Recursive renderer for the terminal split tree.
 *
 * Inspired by Maestro's SplitPaneView. Each SplitNode becomes a flex
 * container, each LeafNode renders via the injected `renderLeaf` callback.
 * Dividers install window-level mouse listeners so drag can continue outside
 * the element's bounds.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { ReactElement, ReactNode, RefObject } from 'react';
import type { TreeNode, SplitNode, LeafNode } from '../lib/splitTree';
import { clampRatio } from '../lib/splitTree';

export interface SplitPaneViewProps {
  node: TreeNode;
  /**
   * Legacy leaf renderer. Receives the leaf's deprecated slotId. Still used
   * by Phase 1 callers (e.g. TerminalGrid). Prefer `renderLeafNode` in new
   * code — it gives you the full LeafNode so you can render a tabbed group.
   */
  renderLeaf: (slotId: string) => ReactNode;
  /**
   * Preferred leaf renderer (Phase 2+). When provided, SplitPaneView calls
   * this with the full LeafNode and does NOT add its own wrapping div or
   * active-ring styling — the leaf component owns its layout.
   */
  renderLeafNode?: (leaf: LeafNode) => ReactNode;
  /** @deprecated Phase 1 compat. Use `activeLeafId` when possible. */
  activeLeafSlotId: string | null;
  /** Preferred: id of the currently-focused leaf (matches LeafNode.id). */
  activeLeafId?: string | null;
  onResize: (nodeId: string, ratio: number) => void;
  onFocusLeaf: (slotId: string) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
}

export function SplitPaneView(props: SplitPaneViewProps): ReactElement {
  return (
    <div
      className="h-full w-full relative [&[data-dragging='true']_.xterm]:pointer-events-none"
      data-dragging={props.isDragging ? 'true' : 'false'}
    >
      <NodeView {...props} />
    </div>
  );
}

// ── Recursive node renderer ─────────────────────────────────────────────────

function NodeView(props: SplitPaneViewProps): ReactElement {
  const { node } = props;

  if (node.type === 'leaf') {
    // When renderLeafNode is provided, the leaf component owns its own
    // wrapper, focus handling, and active-ring styling. We just render it.
    if (props.renderLeafNode) {
      return <>{props.renderLeafNode(node)}</>;
    }

    // Legacy path: wrap the rendered leaf and add the active ring here.
    const isActive =
      props.activeLeafId != null
        ? props.activeLeafId === node.id
        : props.activeLeafSlotId === node.slotId;
    return (
      <div
        className={`h-full w-full min-h-0 min-w-0 flex flex-col bg-bg-deep ${
          isActive ? 'ring-1 ring-accent/30' : ''
        }`}
        onMouseDown={() => props.onFocusLeaf(node.slotId)}
        data-leaf-slot={node.slotId}
      >
        {props.renderLeaf(node.slotId)}
      </div>
    );
  }

  return <SplitNodeView {...props} node={node} />;
}

interface SplitNodeViewProps extends Omit<SplitPaneViewProps, 'node'> {
  node: SplitNode;
}

function SplitNodeView(props: SplitNodeViewProps): ReactElement {
  const { node } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const isHorizontal = node.direction === 'horizontal';
  const ratio = clampRatio(node.ratio);

  const childProps = (child: TreeNode): SplitPaneViewProps => ({
    ...props,
    node: child,
  });

  return (
    <div
      ref={containerRef}
      className={`h-full w-full min-h-0 min-w-0 flex ${
        isHorizontal ? 'flex-row' : 'flex-col'
      }`}
    >
      <div
        className="min-h-0 min-w-0 relative flex"
        style={{ flexGrow: ratio, flexBasis: 0 }}
      >
        <NodeView {...childProps(node.children[0])} />
      </div>
      <Divider
        nodeId={node.id}
        direction={node.direction}
        containerRef={containerRef}
        currentRatio={ratio}
        onResize={props.onResize}
        setIsDragging={props.setIsDragging}
      />
      <div
        className="min-h-0 min-w-0 relative flex"
        style={{ flexGrow: 1 - ratio, flexBasis: 0 }}
      >
        <NodeView {...childProps(node.children[1])} />
      </div>
    </div>
  );
}

// ── Divider ─────────────────────────────────────────────────────────────────

interface DividerProps {
  nodeId: string;
  direction: 'horizontal' | 'vertical';
  containerRef: RefObject<HTMLDivElement | null>;
  currentRatio: number;
  onResize: (nodeId: string, ratio: number) => void;
  setIsDragging: (v: boolean) => void;
}

function Divider({
  nodeId,
  direction,
  containerRef,
  currentRatio,
  onResize,
  setIsDragging,
}: DividerProps): ReactElement {
  const draggingRef = useRef(false);
  const ratioRef = useRef(currentRatio);
  ratioRef.current = currentRatio;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = true;
      setIsDragging(true);
      document.body.style.cursor =
        direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [direction, setIsDragging]
  );

  // Install window listeners once; they read the latest container dims on
  // every event so resizing the window mid-drag is fine.
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      if (!draggingRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total =
        direction === 'horizontal' ? rect.width : rect.height;
      if (total <= 0) return;
      const offset =
        direction === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top;
      const raw = offset / total;
      onResize(nodeId, raw);
    };

    const onUp = (): void => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [containerRef, direction, nodeId, onResize, setIsDragging]);

  const className =
    direction === 'horizontal'
      ? 'shrink-0 w-1 cursor-col-resize bg-border-subtle hover:bg-accent/40 transition-colors z-10'
      : 'shrink-0 h-1 cursor-row-resize bg-border-subtle hover:bg-accent/40 transition-colors z-10';

  return (
    <div
      className={className}
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
    />
  );
}
