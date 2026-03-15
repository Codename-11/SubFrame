/**
 * UpdateNotification — side-effect component that listens for auto-updater
 * events and shows non-intrusive sonner toasts. Renders null.
 *
 * Manual checks (menu / settings "Check Now") show a brief "Checking..." toast
 * then either prompt for download or dismiss silently.
 * Auto/periodic checks only show toasts when an update IS available.
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useUpdater } from '../hooks/useUpdater';

export function UpdateNotification() {
  const { status, version, error, progress, manual, downloadUpdate, installUpdate } = useUpdater();
  const prevStatus = useRef(status);

  useEffect(() => {
    // Only react to status changes
    if (status === prevStatus.current) return;
    prevStatus.current = status;

    switch (status) {
      case 'checking':
        // Only show "Checking..." toast for user-initiated checks
        if (manual) {
          toast.loading('Checking for updates...', { id: 'updater', duration: Infinity });
        }
        break;

      case 'available':
        toast.info(`Update v${version ?? '?'} available`, {
          id: 'updater',
          duration: Infinity,
          action: {
            label: 'Download',
            onClick: () => downloadUpdate.mutate([]),
          },
          cancel: {
            label: 'Later',
            onClick: () => toast.dismiss('updater'),
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
          cancel: {
            label: 'Later',
            onClick: () => toast.dismiss('updater'),
          },
        });
        break;

      case 'error':
        // Only show error toast for manual checks — don't bother the user with auto-check failures
        if (manual) {
          toast.error(`Update check failed: ${error ?? 'Unknown error'}`, {
            id: 'updater',
            duration: 8000,
          });
        } else {
          toast.dismiss('updater');
        }
        break;

      case 'not-available':
        // Silently dismiss — no "you're on the latest version" toast
        toast.dismiss('updater');
        break;
    }
  }, [status, version, error, manual, downloadUpdate, installUpdate]);

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
