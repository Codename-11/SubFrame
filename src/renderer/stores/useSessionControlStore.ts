import { create } from 'zustand';
import type { SessionControlState } from '../../shared/ipcChannels';

/** Build-time define: `true` in web build (build-web.js), undefined in Electron build. */
declare const __SUBFRAME_WEB__: boolean | undefined;

export interface SessionControlStore extends SessionControlState {
  /** True when running in Electron (false for web client) */
  isElectronSide: boolean;
  /** Current side has input control */
  hasControl: boolean;
  /** Current side is view-only (web connected, other side controls) */
  isViewOnly: boolean;
  /** Apply state snapshot from main process */
  applyState: (state: SessionControlState) => void;
}

function deriveControl(state: SessionControlState, isElectron: boolean) {
  const mySide = isElectron ? 'electron' : 'web';
  const hasControl = !state.webClientConnected || state.controller === mySide || state.controller === null;
  const isViewOnly = state.webClientConnected && state.controller !== null && state.controller !== mySide;
  return { hasControl, isViewOnly };
}

export const useSessionControlStore = create<SessionControlStore>((set, get) => {
  // Detect side using build-time define — getTransport() may not be ready at store init time.
  // esbuild replaces __SUBFRAME_WEB__ → true in web build; Electron build leaves it undefined.
  const isElectronSide = typeof __SUBFRAME_WEB__ === 'undefined';

  const initial: SessionControlState = {
    controller: 'electron',
    webClientConnected: false,
    webClientDevice: null,
    controlRequestPending: false,
    controlRequestFrom: null,
    lastElectronActivity: Date.now(),
    lastWebActivity: 0,
    idleTimeoutMs: 30_000,
  };

  return {
    ...initial,
    isElectronSide,
    ...deriveControl(initial, isElectronSide),

    applyState: (state: SessionControlState) => {
      const { hasControl, isViewOnly } = deriveControl(state, get().isElectronSide);
      set({ ...state, hasControl, isViewOnly });
    },
  };
});
