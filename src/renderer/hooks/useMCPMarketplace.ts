/**
 * TanStack Query hooks for the MCP Marketplace.
 *
 * - useMarketplace()  — loads the (currently hardcoded) server registry
 * - useInstalledMCP() — loads the list of servers the user has "installed"
 * - useInstallMCP()   — mutation: marks a server as installed
 * - useUninstallMCP() — mutation: removes an installed record
 */

import { useQueryClient } from '@tanstack/react-query';
import { useIpcQuery, useIpcMutation } from './useIpc';
import { IPC } from '../../shared/ipcChannels';

export function useMarketplace() {
  const query = useIpcQuery(IPC.MCP_LOAD_MARKETPLACE, []);
  return {
    servers: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useInstalledMCP() {
  const query = useIpcQuery(IPC.MCP_LIST_INSTALLED, []);
  return {
    installed: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useInstallMCP() {
  const queryClient = useQueryClient();
  return useIpcMutation(IPC.MCP_INSTALL_SERVER, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [IPC.MCP_LIST_INSTALLED] });
    },
  });
}

export function useUninstallMCP() {
  const queryClient = useQueryClient();
  return useIpcMutation(IPC.MCP_UNINSTALL_SERVER, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [IPC.MCP_LIST_INSTALLED] });
    },
  });
}
