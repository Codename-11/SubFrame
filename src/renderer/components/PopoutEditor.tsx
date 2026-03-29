/**
 * Pop-out editor window UI.
 * Renders a minimal editor view for detached windows.
 *
 * Reads filePath from URL hash: #editor-popout?filePath=<encoded>
 * Provides a Dock button to return the editor to the main window.
 */

import { ArrowLeftToLine } from 'lucide-react';
import { Editor } from './Editor';
import { ThemeProvider } from './ThemeProvider';
import { ErrorBoundary } from './ErrorBoundary';
import { typedInvoke } from '../lib/ipc';
import { IPC } from '../../shared/ipcChannels';

interface PopoutEditorProps {
  filePath: string;
}

export function PopoutEditor({ filePath }: PopoutEditorProps) {
  const fileName = filePath.split(/[/\\]/).pop() ?? 'Editor';

  const handleDock = () => {
    typedInvoke(IPC.EDITOR_DOCK, filePath).catch(() => {});
  };

  return (
    <>
      <ThemeProvider />
      <div className="flex flex-col h-screen bg-bg-deep text-text-primary">
        {/* Toolbar */}
        <div className="flex items-center justify-between h-9 px-3 bg-bg-secondary border-b border-border-subtle flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="font-medium text-text-primary">{fileName}</span>
          </div>
          <button
            onClick={handleDock}
            className="flex items-center gap-1.5 px-2.5 h-6 rounded text-xs text-text-secondary
                       hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
            title="Dock back to main window"
          >
            <ArrowLeftToLine className="h-3.5 w-3.5" />
            <span>Dock</span>
          </button>
        </div>

        {/* Editor */}
        <div className="flex-1 min-h-0">
          <ErrorBoundary name="PopoutEditor">
            <Editor filePath={filePath} onClose={() => window.close()} inline />
          </ErrorBoundary>
        </div>
      </div>
    </>
  );
}
