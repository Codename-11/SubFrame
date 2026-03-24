/**
 * UpdateNotification — side-effect component that listens for auto-updater
 * events and shows non-intrusive sonner toasts. Renders null.
 *
 * Manual checks (menu / settings "Check Now") show a brief "Checking..." toast
 * then either prompt for download or dismiss silently.
 * Auto/periodic checks only show toasts when an update IS available.
 *
 * "Later" snoozes the notification for 30 minutes (default).
 */

import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useUpdater } from '../hooks/useUpdater';

/** Snooze duration in ms — 30 minutes */
const SNOOZE_DURATION = 30 * 60 * 1000;

/** localStorage key for snooze timestamp */
const SNOOZE_KEY = 'subframe-update-snoozed-until';

function isSnoozed(): boolean {
  try {
    const until = localStorage.getItem(SNOOZE_KEY);
    if (!until) return false;
    return Date.now() < parseInt(until, 10);
  } catch {
    return false;
  }
}

function snooze(durationMs: number = SNOOZE_DURATION): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + durationMs));
  } catch { /* ignore */ }
}

function clearSnooze(): void {
  try {
    localStorage.removeItem(SNOOZE_KEY);
  } catch { /* ignore */ }
}

function formatSnoozeRemaining(): string {
  try {
    const until = localStorage.getItem(SNOOZE_KEY);
    if (!until) return '';
    const remaining = parseInt(until, 10) - Date.now();
    if (remaining <= 0) return '';
    const mins = Math.ceil(remaining / 60000);
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  } catch {
    return '';
  }
}

export function UpdateNotification() {
  const { status, version, error, progress, manual, downloadUpdate, installUpdate } = useUpdater();
  const prevStatus = useRef(status);

  const handleSnooze = useCallback(() => {
    snooze();
    toast.dismiss('updater');
    const remaining = formatSnoozeRemaining();
    toast('Update snoozed', {
      description: remaining ? `Will remind you in ${remaining}` : 'Will remind you later',
      duration: 3000,
    });
  }, []);

  useEffect(() => {
    // Only react to status changes
    if (status === prevStatus.current) return;
    // Don't regress from 'downloaded' — periodic checks could cycle through
    // checking → not-available and dismiss the "Restart Now" toast
    if (prevStatus.current === 'downloaded' && status !== 'error') return;
    prevStatus.current = status;

    switch (status) {
      case 'checking':
        // Only show "Checking..." toast for user-initiated checks
        if (manual) {
          clearSnooze(); // Manual check clears any snooze
          toast.loading('Checking for updates...', { id: 'updater', duration: Infinity });
        }
        break;

      case 'available':
        // Skip if snoozed (unless manual check)
        if (!manual && isSnoozed()) return;
        toast.info(`Update v${version ?? '?'} available`, {
          id: 'updater',
          duration: Infinity,
          action: {
            label: 'Download',
            onClick: () => { clearSnooze(); downloadUpdate.mutate([]); },
          },
          cancel: {
            label: 'Later',
            onClick: handleSnooze,
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
        // Always show "restart" toast — even if snoozed, the download is done
        toast.success('Update ready — restart to install', {
          id: 'updater',
          duration: Infinity,
          action: {
            label: 'Restart Now',
            onClick: () => installUpdate.mutate([]),
          },
          cancel: {
            label: 'Later',
            onClick: handleSnooze,
          },
        });
        break;

      case 'error':
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
        if (manual) {
          toast.success('You\'re on the latest version', { id: 'updater', duration: 4000 });
        } else {
          toast.dismiss('updater');
        }
        break;
    }
  }, [status, version, error, manual, downloadUpdate, installUpdate, handleSnooze]);

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
