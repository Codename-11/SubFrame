/**
 * WhatsNew — Dialog that surfaces release notes after updates.
 * Auto-shows when the app version is newer than the last-seen version.
 * Also accessible via command palette.
 */

import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { MarkdownPreview } from './previews/MarkdownPreview';
import { useIpcQuery } from '../hooks/useIpc';
import { useSettings } from '../hooks/useSettings';
import { IPC } from '../../shared/ipcChannels';

const { ipcRenderer } = require('electron');

export function WhatsNew() {
  const [open, setOpen] = useState(false);
  const { settings } = useSettings();

  const { data: releaseNotes, isError } = useIpcQuery(
    IPC.GET_RELEASE_NOTES,
    [],
    { enabled: true }
  );

  // Auto-show after version update (not on first install)
  useEffect(() => {
    if (!releaseNotes?.version || !settings) return;

    const lastSeenVersion = (settings as Record<string, unknown>).lastSeenWhatsNew as string | undefined;
    // Only auto-show when there IS a previous version recorded but it differs.
    // undefined = first install → silently record current version, don't show.
    if (!lastSeenVersion) {
      ipcRenderer.invoke(IPC.UPDATE_SETTING, {
        key: 'lastSeenWhatsNew',
        value: releaseNotes.version,
      });
      return;
    }
    if (lastSeenVersion !== releaseNotes.version) {
      const timer = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [releaseNotes?.version, settings]);

  // Mark version as seen when dialog closes
  const handleClose = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen && releaseNotes?.version) {
        ipcRenderer.invoke(IPC.UPDATE_SETTING, {
          key: 'lastSeenWhatsNew',
          value: releaseNotes.version,
        });
      }
    },
    [releaseNotes?.version]
  );

  // Listen for command palette trigger
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-whats-new', handler);
    return () => window.removeEventListener('open-whats-new', handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-accent" />
            What&apos;s New
            {releaseNotes?.version && (
              <span className="text-xs font-mono text-text-tertiary font-normal">
                v{releaseNotes.version}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0 max-h-[60vh] pr-2">
          {releaseNotes?.content ? (
            <MarkdownPreview content={releaseNotes.content} />
          ) : isError ? (
            <p className="text-text-tertiary text-xs">Release notes unavailable</p>
          ) : (
            <p className="text-text-tertiary text-xs">Loading release notes...</p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
