/**
 * TanStack Query hook for settings management.
 */

import { useIpcQuery, useIpcMutation } from './useIpc';
import { useIPCListener } from './useIPCListener';
import { IPC } from '../../shared/ipcChannels';

export function useSettings() {
  useIPCListener(IPC.SETTINGS_UPDATED, [[IPC.LOAD_SETTINGS]]);

  const query = useIpcQuery(IPC.LOAD_SETTINGS, []);

  const updateSetting = useIpcMutation(IPC.UPDATE_SETTING, {
    onSuccess: () => query.refetch(),
  });

  return {
    settings: query.data ?? {},
    isLoading: query.isLoading,
    refetch: query.refetch,
    updateSetting,
  };
}

export function useAIToolConfig() {
  useIPCListener(IPC.AI_TOOL_CHANGED, [[IPC.GET_AI_TOOL_CONFIG]]);

  const query = useIpcQuery(IPC.GET_AI_TOOL_CONFIG, []);

  const setAITool = useIpcMutation(IPC.SET_AI_TOOL, {
    onSuccess: () => query.refetch(),
  });

  const addCustomTool = useIpcMutation(IPC.ADD_CUSTOM_AI_TOOL, {
    onSuccess: () => query.refetch(),
  });

  const removeCustomTool = useIpcMutation(IPC.REMOVE_CUSTOM_AI_TOOL, {
    onSuccess: () => query.refetch(),
  });

  return {
    config: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
    setAITool,
    addCustomTool,
    removeCustomTool,
  };
}
