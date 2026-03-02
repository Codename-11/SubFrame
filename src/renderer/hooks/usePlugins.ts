/**
 * TanStack Query hook for plugin management.
 */

import { useIpcQuery, useIpcMutation } from './useIpc';
import { useIPCListener } from './useIPCListener';
import { IPC } from '../../shared/ipcChannels';

export function usePlugins() {
  useIPCListener(IPC.PLUGIN_TOGGLED, [[IPC.LOAD_PLUGINS]]);

  const query = useIpcQuery(IPC.LOAD_PLUGINS, []);

  const togglePlugin = useIpcMutation(IPC.TOGGLE_PLUGIN, {
    onSuccess: () => query.refetch(),
  });

  return {
    plugins: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    togglePlugin,
  };
}
