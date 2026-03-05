/**
 * WhatsNew — Dialog that surfaces release notes after updates.
 * Auto-shows when the app version is newer than the last-seen version.
 * Also accessible via command palette.
 */

import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
      <DialogContent className="bg-bg-primary border-border-subtle text-text-primary sm:max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
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
        <ScrollArea className="flex-1 min-h-0 max-h-[60vh]">
          {releaseNotes?.content ? (
            <div className="px-4 py-2 text-sm text-text-secondary leading-relaxed [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-accent [&_h1]:mb-3 [&_h1]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-text-primary [&_h2]:mb-2 [&_h2]:mt-4 [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-text-primary [&_h3]:mb-2 [&_h3]:mt-3 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3 [&_li]:mb-1 [&_strong]:text-text-primary [&_strong]:font-semibold [&_code]:bg-bg-tertiary [&_code]:text-accent [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-tertiary [&_blockquote]:mb-3 [&_hr]:border-border-subtle [&_hr]:my-4 [&_a]:text-info [&_a]:hover:underline">
              <Markdown remarkPlugins={[remarkGfm]}>
                {releaseNotes.content}
              </Markdown>
            </div>
          ) : isError ? (
            <p className="text-text-tertiary text-xs p-4">Release notes unavailable</p>
          ) : (
            <p className="text-text-tertiary text-xs p-4">Loading release notes...</p>
          )}
        </ScrollArea>
        <DialogFooter className="pt-2 border-t border-border-subtle">
          <DialogClose asChild>
            <Button variant="ghost" className="cursor-pointer">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
