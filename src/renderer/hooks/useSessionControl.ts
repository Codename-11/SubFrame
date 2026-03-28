import { useEffect } from 'react';
import { IPC } from '../../shared/ipcChannels';
import { typedSend } from '../lib/ipc';
import { getTransport } from '../lib/transportProvider';
import { useSessionControlStore } from '../stores/useSessionControlStore';

/** Initialize session control — call once in App. */
export function useSessionControl() {
  const store = useSessionControlStore();

  useEffect(() => {
    // Hydrate initial state
    getTransport().invoke(IPC.SESSION_CONTROL_STATE)
      .then((state) => useSessionControlStore.getState().applyState(state))
      .catch(() => { /* server may not support yet */ });

    // Listen for live updates
    return getTransport().on(IPC.SESSION_CONTROL_STATE, (_event: unknown, data: unknown) => {
      const state = data as import('../../shared/ipcChannels').SessionControlState;
      const isElectron = useSessionControlStore.getState().isElectronSide;
      console.log(`[Session Control] Received state: controller=${state.controller}, webConnected=${state.webClientConnected}, mySide=${isElectron ? 'electron' : 'web'}`);
      useSessionControlStore.getState().applyState(state);
      const derived = useSessionControlStore.getState();
      console.log(`[Session Control] Derived: hasControl=${derived.hasControl}, isViewOnly=${derived.isViewOnly}`);
    });
  }, []);

  return store;
}

/** Send control actions — usable from any component */
export function requestControl() { typedSend(IPC.SESSION_CONTROL_REQUEST); }
export function grantControl() { typedSend(IPC.SESSION_CONTROL_GRANT); }
export function takeControl() { typedSend(IPC.SESSION_CONTROL_TAKE); }
export function releaseControl() { typedSend(IPC.SESSION_CONTROL_RELEASE); }
