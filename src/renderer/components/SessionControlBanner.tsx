/**
 * SessionControlBanner — shown at top of main content when a web client is connected.
 * Displays connection status, who has control, and action buttons for handoff.
 */

import { Monitor, Smartphone, ArrowRightLeft, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSessionControlStore } from '../stores/useSessionControlStore';
import { requestControl, grantControl, takeControl, releaseControl } from '../hooks/useSessionControl';

export function SessionControlBanner() {
  const {
    controller,
    webClientConnected,
    webClientDevice,
    controlRequestPending,
    controlRequestFrom,
    isElectronSide,
    hasControl,
    isViewOnly,
  } = useSessionControlStore();

  if (!webClientConnected) return null;

  const mySide = isElectronSide ? 'electron' : 'web';
  const otherSide = isElectronSide ? 'web' : 'electron';
  const deviceLabel = webClientDevice || 'Remote';
  const isRequestFromOther = controlRequestPending && controlRequestFrom === otherSide;
  const isRequestFromMe = controlRequestPending && controlRequestFrom === mySide;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1 border-b text-[11px] shrink-0 select-none',
        isRequestFromOther
          ? 'bg-warning/8 border-warning/20 text-warning'
          : isViewOnly
            ? 'bg-info/8 border-info/20 text-info'
            : 'bg-accent/5 border-accent/15 text-text-secondary',
      )}
    >
      {isElectronSide ? (
        <Smartphone size={12} className="shrink-0 opacity-70" />
      ) : (
        <Monitor size={12} className="shrink-0 opacity-70" />
      )}

      {/* Status text */}
      {isElectronSide ? (
        <span className="flex-1 min-w-0 truncate">
          {isRequestFromOther
            ? `${deviceLabel} wants control`
            : hasControl
              ? `${deviceLabel} connected · You have control`
              : `${deviceLabel} has control · View only`
          }
        </span>
      ) : (
        <span className="flex-1 min-w-0 truncate">
          {isRequestFromOther
            ? 'Desktop wants control'
            : isRequestFromMe
              ? 'Control requested · Waiting...'
              : hasControl
                ? 'Connected · You have control'
                : 'Connected · View only'
          }
        </span>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {isRequestFromOther && (
          <>
            <button
              onClick={grantControl}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-warning/15 hover:bg-warning/25 text-warning text-[10px] font-medium transition-colors cursor-pointer"
            >
              <Check size={10} />
              Grant
            </button>
            <button
              onClick={() => takeControl()}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-muted text-[10px] transition-colors cursor-pointer"
            >
              <X size={10} />
              Dismiss
            </button>
          </>
        )}

        {isViewOnly && !isRequestFromMe && (
          <button
            onClick={requestControl}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary text-[10px] font-medium transition-colors cursor-pointer"
          >
            <ArrowRightLeft size={10} />
            Request Control
          </button>
        )}

        {isViewOnly && (
          <button
            onClick={takeControl}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent/15 hover:bg-accent/25 text-accent text-[10px] font-medium transition-colors cursor-pointer"
          >
            Take Control
          </button>
        )}

        {hasControl && controller !== null && (
          <button
            onClick={releaseControl}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-muted text-[10px] transition-colors cursor-pointer"
          >
            Release
          </button>
        )}
      </div>
    </div>
  );
}
