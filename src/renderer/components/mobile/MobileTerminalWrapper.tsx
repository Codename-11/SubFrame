/**
 * Mobile terminal wrapper.
 * Renders the active terminal at full width using the existing Terminal component.
 * Falls back to a "no terminals" message if none exist.
 */

import { useTerminalStore } from '../../stores/useTerminalStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { Terminal } from '../Terminal';

export function MobileTerminalWrapper() {
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const terminals = useTerminalStore((s) => s.terminals);
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);

  // Filter to current project
  const projectTerminals = Array.from(terminals.values()).filter(
    (t) => (t.projectPath || '') === (currentProjectPath ?? ''),
  );

  if (!activeTerminalId || projectTerminals.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-deep text-text-muted">
        <div className="text-center space-y-2 px-6">
          <p className="text-sm">No terminals open</p>
          <p className="text-xs text-text-tertiary">
            Terminals will appear here when a project is loaded
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 bg-bg-deep">
      <Terminal terminalId={activeTerminalId} className="h-full" />
    </div>
  );
}
