/**
 * TerminalGrid — Phase 3 pass-through.
 *
 * Historically this rendered the split-tree of terminals. As of Phase 3 the
 * unified split tree (terminals + editors + panels as tabs inside leaves) is
 * rendered directly by `TerminalArea` via `SplitPaneView` + `LeafGroupView`,
 * so this component is now a thin wrapper kept only to avoid breaking the
 * existing `import { TerminalGrid }` call site.
 *
 * Props are accepted for API compatibility but most are ignored — the leaf
 * content, tab bar, drag-and-drop, and maximize behavior now all live in
 * `LeafGroupView`. Once TerminalArea stops referencing this file entirely it
 * can be deleted.
 */

import { useCallback, useState } from 'react';
import { SplitPaneView } from './SplitPaneView';
import { LeafGroupView } from './LeafGroupView';
import { useTerminalStore, type TerminalInfo } from '../stores/useTerminalStore';

interface TerminalGridProps {
  /** @deprecated close handler now lives inside LeafGroupView tab bar */
  onCloseTerminal?: (id: string) => void;
  /** @deprecated create handler moved to Phase 3 intercepts */
  onCreateTerminal?: (shell?: string) => void;
  /** @deprecated pop-out lives in LeafGroupView */
  onPopOutTerminal?: (id: string) => void;
  /** @deprecated reconciliation now happens in TerminalArea */
  projectTerminals?: TerminalInfo[];
  projectPath?: string;
}

export function TerminalGrid({ projectPath }: TerminalGridProps) {
  const layoutTree = useTerminalStore((s) => s.layoutTree);
  const activeLeafId = useTerminalStore((s) => s.activeLeafId);
  const setActiveLeafId = useTerminalStore((s) => s.setActiveLeafId);
  const resizeLeafSplit = useTerminalStore((s) => s.resizeLeafSplit);
  const [isDragging, setIsDragging] = useState(false);

  const handleResize = useCallback(
    (nodeId: string, ratio: number) => {
      resizeLeafSplit(nodeId, ratio, projectPath);
    },
    [resizeLeafSplit, projectPath]
  );

  return (
    <SplitPaneView
      node={layoutTree}
      renderLeaf={() => null}
      renderLeafNode={(leaf) => (
        <LeafGroupView
          leaf={leaf}
          isActive={leaf.id === activeLeafId}
          onFocus={() => setActiveLeafId(leaf.id)}
          currentProjectPath={projectPath ?? ''}
        />
      )}
      activeLeafSlotId={null}
      activeLeafId={activeLeafId}
      onResize={handleResize}
      onFocusLeaf={() => { /* legacy */ }}
      isDragging={isDragging}
      setIsDragging={setIsDragging}
    />
  );
}
