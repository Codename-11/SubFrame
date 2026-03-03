/**
 * UpdateNotification — side-effect component that listens for auto-updater
 * events and shows non-intrusive sonner toasts. Renders null.
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useUpdater } from '../hooks/useUpdater';

export function UpdateNotification() {
  const { status, version, error, progress, downloadUpdate, installUpdate } = useUpdater();
  const prevStatus = useRef(status);

  useEffect(() => {
    // Only react to status changes
    if (status === prevStatus.current) return;
    prevStatus.current = status;

    switch (status) {
      case 'available':
        toast.info(`Update v${version ?? '?'} available`, {
          id: 'updater',
          duration: Infinity,
          action: {
            label: 'Download',
            onClick: () => downloadUpdate.mutate([]),
          },
        });
        break;

      case 'downloading':
        toast.loading('Downloading update...', {
          id: 'updater',
          duration: Infinity,
        });
        break;

      case 'downloaded':
        toast.success('Update ready — restart to install', {
          id: 'updater',
          duration: Infinity,
          action: {
            label: 'Restart Now',
            onClick: () => installUpdate.mutate([]),
          },
        });
        break;

      case 'error':
        toast.error(`Update error: ${error ?? 'Unknown error'}`, {
          id: 'updater',
          duration: 8000,
        });
        break;

      case 'not-available':
        // Dismiss any existing updater toast silently
        toast.dismiss('updater');
        break;
    }
  }, [status, version, error, downloadUpdate, installUpdate]);

  // Update progress toast description when downloading
  useEffect(() => {
    if (status === 'downloading' && progress) {
      toast.loading(`Downloading update... ${Math.round(progress.percent)}%`, {
        id: 'updater',
        duration: Infinity,
      });
    }
  }, [status, progress]);

  return null;
}
