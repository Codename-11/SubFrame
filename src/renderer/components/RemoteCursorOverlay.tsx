import { useEffect, useRef, useState } from 'react';
import { MousePointer2 } from 'lucide-react';
import { IPC, type WebRemotePointerState } from '../../shared/ipcChannels';
import { getTransport } from '../lib/transportProvider';
import { useSettings } from '../hooks/useSettings';

const POINTER_SEND_INTERVAL_MS = 32;
const POINTER_HIDE_AFTER_MS = 2500;

function useRemoteCursorEnabled(): boolean {
  const { settings } = useSettings();
  return ((settings?.server as Record<string, unknown>)?.showRemoteCursor) === true;
}

export function RemotePointerPublisher() {
  const enabled = useRemoteCursorEnabled();

  useEffect(() => {
    if (getTransport().platform.isElectron) return;
    if (!enabled) return;

    const lastSentAtRef = { current: 0 };

    const sendPointer = (
      event: PointerEvent | null,
      phase: 'move' | 'down' | 'up' | 'leave',
      force = false,
    ) => {
      const now = Date.now();
      if (!force && phase === 'move' && now - lastSentAtRef.current < POINTER_SEND_INTERVAL_MS) {
        return;
      }

      lastSentAtRef.current = now;
      const normalizedX = event ? Math.max(0, Math.min(1, event.clientX / Math.max(window.innerWidth, 1))) : 0;
      const normalizedY = event ? Math.max(0, Math.min(1, event.clientY / Math.max(window.innerHeight, 1))) : 0;

      getTransport().send(IPC.WEB_REMOTE_POINTER_SYNC, {
        normalizedX,
        normalizedY,
        pointerType: event?.pointerType === 'pen' ? 'pen' : event?.pointerType === 'touch' ? 'touch' : 'mouse',
        phase,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        timestamp: now,
      });
    };

    const onPointerMove = (event: PointerEvent) => sendPointer(event, 'move');
    const onPointerDown = (event: PointerEvent) => sendPointer(event, 'down', true);
    const onPointerUp = (event: PointerEvent) => sendPointer(event, 'up', true);
    const clearPointer = () => sendPointer(null, 'leave', true);
    const onVisibilityChange = () => {
      if (document.hidden) clearPointer();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', clearPointer);
    window.addEventListener('blur', clearPointer);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', clearPointer);
      window.removeEventListener('blur', clearPointer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearPointer();
    };
  }, [enabled]);

  return null;
}

export function RemoteCursorOverlay() {
  const enabled = useRemoteCursorEnabled();
  const [pointer, setPointer] = useState<WebRemotePointerState | null>(null);
  const [pressedAt, setPressedAt] = useState<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!getTransport().platform.isElectron) return;

    const clearPointer = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setPointer(null);
      setPressedAt(null);
    };

    const scheduleHide = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setPointer(null);
      }, POINTER_HIDE_AFTER_MS);
    };

    const unsubUpdate = getTransport().on(IPC.WEB_REMOTE_POINTER_UPDATED, (_event, data: WebRemotePointerState) => {
      setPointer(data);
      if (data.phase === 'down') {
        setPressedAt(Date.now());
      }
      scheduleHide();
    });

    const unsubClear = getTransport().on(IPC.WEB_REMOTE_POINTER_CLEARED, clearPointer);
    const unsubDisconnect = getTransport().on(IPC.WEB_CLIENT_DISCONNECTED, clearPointer);

    return () => {
      unsubUpdate();
      unsubClear();
      unsubDisconnect();
      clearPointer();
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setPointer(null);
      setPressedAt(null);
    }
  }, [enabled]);

  if (!getTransport().platform.isElectron || !enabled || !pointer) return null;

  const left = `${pointer.normalizedX * 100}%`;
  const top = `${pointer.normalizedY * 100}%`;
  const showPulse = pressedAt !== null && Date.now() - pressedAt < 450;

  return (
    <div className="pointer-events-none fixed inset-0 z-[120]">
      <div
        className="absolute transition-transform duration-75 ease-out"
        style={{ left, top, transform: 'translate(-14%, -12%)' }}
      >
        <div className="relative">
          {showPulse && (
            <div className="absolute left-1 top-1 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/60 bg-accent/10 animate-ping" />
          )}
          <div className="absolute -top-7 left-4 rounded-full border border-border-default bg-bg-elevated/95 px-2 py-1 text-[10px] font-medium text-text-primary shadow-lg backdrop-blur">
            {pointer.label}
          </div>
          <div className="relative flex items-center justify-center">
            <MousePointer2
              className={`h-5 w-5 drop-shadow-[0_0_12px_rgba(0,0,0,0.4)] ${
                pointer.pointerType === 'touch' ? 'text-blue-400' : 'text-accent'
              }`}
              fill="currentColor"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
