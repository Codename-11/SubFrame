/**
 * MCP Marketplace Manager
 *
 * Greenfield MCP (Model Context Protocol) server marketplace for SubFrame.
 * In this initial pass the "registry" is a hardcoded list of popular
 * MCP servers sourced from https://github.com/modelcontextprotocol/servers.
 * Installation is tracked in ~/.subframe/mcp-installed.json AND mirrored
 * into ~/.claude.json so Claude Code actually loads the server.
 */

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { IpcMain } from 'electron';
import { IPC } from '../shared/ipcChannels';
import { broadcast } from './eventBridge';

// ── Types ───────────────────────────────────────────────────────────────────

export interface MCPServerEntry {
  id: string;
  name: string;
  description: string;
  publisher: 'Anthropic' | 'Community';
  packageName: string;
  tags: string[];
  installCount: number;
  homepage: string;
}

export interface MCPInstalledEntry {
  id: string;
  packageName: string;
  installedAt: string;
  config?: Record<string, unknown>;
}

interface InstalledFile {
  version: 1;
  servers: MCPInstalledEntry[];
}

// ── Registry (hardcoded initial seed) ───────────────────────────────────────

const REGISTRY: MCPServerEntry[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Secure file operations with configurable access controls',
    publisher: 'Anthropic',
    packageName: '@modelcontextprotocol/server-filesystem',
    tags: ['files', 'storage', 'local'],
    installCount: 48200,
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Repository management, file operations, and GitHub API integration',
    publisher: 'Anthropic',
    packageName: '@modelcontextprotocol/server-github',
    tags: ['git', 'github', 'code', 'api'],
    installCount: 36500,
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Knowledge graph-based persistent memory system',
    publisher: 'Anthropic',
    packageName: '@modelcontextprotocol/server-memory',
    tags: ['memory', 'knowledge-graph', 'persistence'],
    installCount: 22100,
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    description: 'Dynamic and reflective problem-solving through thought sequences',
    publisher: 'Anthropic',
    packageName: '@modelcontextprotocol/server-sequential-thinking',
    tags: ['reasoning', 'planning', 'thinking'],
    installCount: 18400,
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
  },
  {
    id: 'fetch',
    name: 'Fetch',
    description: 'Web content fetching and conversion for efficient LLM usage',
    publisher: 'Anthropic',
    packageName: '@modelcontextprotocol/server-fetch',
    tags: ['web', 'http', 'fetch', 'scraping'],
    installCount: 31200,
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: "Web and local search using Brave's Search API",
    publisher: 'Anthropic',
    packageName: '@modelcontextprotocol/server-brave-search',
    tags: ['search', 'web', 'brave'],
    installCount: 14800,
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
  },
];

// ── File-backed installed state ─────────────────────────────────────────────

function getInstalledFilePath(): string {
  const dir = path.join(os.homedir(), '.subframe');
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error('[mcpMarketplaceManager] Failed to create ~/.subframe:', err);
  }
  return path.join(dir, 'mcp-installed.json');
}

function readInstalledFile(): InstalledFile {
  const file = getInstalledFilePath();
  if (!fs.existsSync(file)) return { version: 1, servers: [] };
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.servers)) {
      return { version: 1, servers: parsed.servers };
    }
    return { version: 1, servers: [] };
  } catch (err) {
    console.error('[mcpMarketplaceManager] Failed to read installed file:', err);
    return { version: 1, servers: [] };
  }
}

function writeInstalledFile(data: InstalledFile): void {
  const file = getInstalledFilePath();
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[mcpMarketplaceManager] Failed to write installed file:', err);
  }
}

// ── ~/.claude.json merge (actual Claude Code wiring) ────────────────────────

interface ClaudeMcpEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface ClaudeConfigShape {
  mcpServers?: Record<string, ClaudeMcpEntry>;
  [key: string]: unknown;
}

function getClaudeConfigPath(): string {
  return path.join(os.homedir(), '.claude.json');
}

/**
 * Merge (or remove) a single MCP server entry into ~/.claude.json.
 *
 * Semantics:
 *  - Shallow merge of `mcpServers`: all unrelated server entries and all
 *    unrelated top-level keys in ~/.claude.json are preserved as-is.
 *  - If `entry` is provided, `mcpServers[serverId]` is set (replacing any
 *    prior value for that id).
 *  - If `entry` is null, `mcpServers[serverId]` is deleted. If it was the
 *    last server, the empty `mcpServers` object is left in place so the
 *    key is stable for downstream tools.
 *  - If ~/.claude.json does not exist, it is created with just
 *    `{ "mcpServers": { ... } }`.
 *  - If ~/.claude.json exists but is not valid JSON we refuse to clobber
 *    it and return an error (caller surfaces as IPC error).
 *  - Writes are atomic: write to `<target>.subframe.tmp` then rename.
 */
async function mergeClaudeConfig(
  serverId: string,
  entry: ClaudeMcpEntry | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const target = getClaudeConfigPath();

  let config: ClaudeConfigShape = {};
  let existed = false;
  try {
    const raw = await fsp.readFile(target, 'utf8');
    existed = true;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        config = parsed as ClaudeConfigShape;
      } else {
        console.warn(
          '[mcpMarketplaceManager] ~/.claude.json is not a JSON object; refusing to overwrite'
        );
        return { ok: false, error: 'claude-config-not-object' };
      }
    } catch (parseErr) {
      console.warn(
        '[mcpMarketplaceManager] ~/.claude.json is not valid JSON; refusing to overwrite:',
        parseErr
      );
      return { ok: false, error: 'claude-config-parse-error' };
    }
  } catch (readErr) {
    const code = (readErr as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') {
      console.error('[mcpMarketplaceManager] Failed to read ~/.claude.json:', readErr);
      return { ok: false, error: 'claude-config-read-error' };
    }
    // ENOENT is fine — we'll create the file below.
  }

  // Shallow clone top-level + mcpServers so we don't mutate `config` directly.
  const next: ClaudeConfigShape = { ...config };
  const existingServers =
    next.mcpServers && typeof next.mcpServers === 'object' && !Array.isArray(next.mcpServers)
      ? { ...next.mcpServers }
      : {};
  next.mcpServers = existingServers;

  if (entry) {
    existingServers[serverId] = entry;
  } else {
    delete existingServers[serverId];
  }

  const serialized = JSON.stringify(next, null, 2) + '\n';
  const tmp = `${target}.subframe.tmp`;
  try {
    await fsp.writeFile(tmp, serialized, 'utf8');
    await fsp.rename(tmp, target);
  } catch (writeErr) {
    console.error(
      '[mcpMarketplaceManager] Failed to write ~/.claude.json atomically:',
      writeErr
    );
    // Best-effort cleanup of the tmp file.
    try {
      await fsp.unlink(tmp);
    } catch {
      /* ignore */
    }
    return { ok: false, error: 'claude-config-write-error' };
  }

  void existed; // retained for potential future telemetry
  return { ok: true };
}

/**
 * Build the Claude Code MCP entry for a registry server. For servers that
 * require a path argument (currently `filesystem`), fall back to the user's
 * home directory when the caller did not provide one. Sophisticated per-server
 * arg configuration is left for a follow-up pass.
 */
function buildClaudeEntry(
  entry: MCPServerEntry,
  config?: Record<string, unknown>
): ClaudeMcpEntry {
  const overrideArgs = Array.isArray(config?.args)
    ? (config!.args as unknown[]).filter((a): a is string => typeof a === 'string')
    : null;
  const overrideEnv =
    config?.env && typeof config.env === 'object' && !Array.isArray(config.env)
      ? (Object.fromEntries(
          Object.entries(config.env as Record<string, unknown>).filter(
            ([, v]) => typeof v === 'string'
          )
        ) as Record<string, string>)
      : undefined;

  const baseArgs = ['-y', entry.packageName];
  let extraArgs: string[];
  if (overrideArgs && overrideArgs.length > 0) {
    extraArgs = overrideArgs;
  } else if (entry.id === 'filesystem') {
    extraArgs = [os.homedir()];
  } else {
    extraArgs = [];
  }

  const result: ClaudeMcpEntry = {
    command: 'npx',
    args: [...baseArgs, ...extraArgs],
  };
  if (overrideEnv && Object.keys(overrideEnv).length > 0) {
    result.env = overrideEnv;
  }
  return result;
}

// ── Public API ──────────────────────────────────────────────────────────────

function loadMarketplace(): MCPServerEntry[] {
  // Return a defensive copy so renderer mutations can't affect the registry.
  return REGISTRY.map((entry) => ({ ...entry, tags: [...entry.tags] }));
}

function listInstalled(): MCPInstalledEntry[] {
  return readInstalledFile().servers;
}

async function installServer(
  id: string,
  config?: Record<string, unknown>
): Promise<{
  success: boolean;
  error?: string;
  installed?: MCPInstalledEntry;
}> {
  const entry = REGISTRY.find((e) => e.id === id);
  if (!entry) return { success: false, error: `Unknown MCP server id: ${id}` };

  const data = readInstalledFile();
  if (data.servers.some((s) => s.id === id)) {
    return { success: false, error: 'Server already installed' };
  }

  // Write the actual Claude Code config first — if this fails we don't
  // want the SubFrame tracking file to claim the server is installed.
  const claudeEntry = buildClaudeEntry(entry, config);
  const mergeResult = await mergeClaudeConfig(id, claudeEntry);
  if (!mergeResult.ok) {
    return {
      success: false,
      error: `Failed to update ~/.claude.json (${mergeResult.error})`,
    };
  }

  const installed: MCPInstalledEntry = {
    id,
    packageName: entry.packageName,
    installedAt: new Date().toISOString(),
    config,
  };
  data.servers.push(installed);
  writeInstalledFile(data);
  broadcast(IPC.MCP_INSTALLED_CHANGED, { installed: data.servers });
  return { success: true, installed };
}

async function uninstallServer(id: string): Promise<{ success: boolean; error?: string }> {
  const data = readInstalledFile();
  const next = data.servers.filter((s) => s.id !== id);
  if (next.length === data.servers.length) {
    return { success: false, error: 'Server not installed' };
  }

  // Only touch ~/.claude.json for servers we know about in the registry —
  // this guards against accidentally deleting a user-managed entry that
  // happens to share an id string.
  const registryEntry = REGISTRY.find((e) => e.id === id);
  if (registryEntry) {
    const mergeResult = await mergeClaudeConfig(id, null);
    if (!mergeResult.ok) {
      return {
        success: false,
        error: `Failed to update ~/.claude.json (${mergeResult.error})`,
      };
    }
  }

  writeInstalledFile({ version: 1, servers: next });
  broadcast(IPC.MCP_INSTALLED_CHANGED, { installed: next });
  return { success: true };
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

function init(): void {
  // Ensure the installed file exists (touches ~/.subframe/mcp-installed.json)
  // so downstream reads return a stable shape from the start.
  const data = readInstalledFile();
  if (!fs.existsSync(getInstalledFilePath())) {
    writeInstalledFile(data);
  }
}

function setupIPC(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.MCP_LOAD_MARKETPLACE, () => {
    return loadMarketplace();
  });

  ipcMain.handle(IPC.MCP_LIST_INSTALLED, () => {
    return listInstalled();
  });

  ipcMain.handle(
    IPC.MCP_INSTALL_SERVER,
    async (_event, payload: { id: string; config?: Record<string, unknown> }) => {
      return installServer(payload.id, payload.config);
    }
  );

  ipcMain.handle(IPC.MCP_UNINSTALL_SERVER, async (_event, payload: { id: string }) => {
    return uninstallServer(payload.id);
  });
}

export { init, setupIPC, loadMarketplace, listInstalled, installServer, uninstallServer };
