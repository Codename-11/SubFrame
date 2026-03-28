/**
 * Web-mode entry point for SubFrame Server.
 *
 * Identical to index.tsx but initializes WebSocketTransport instead of
 * ElectronTransport. Used when SubFrame is accessed via browser.
 *
 * Access can come from a direct tokenized URL or from the base URL by
 * pairing with a short code / pasting a session token in the browser UI.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { App } from './components/App';
import { setTransport } from './lib/transportProvider';
import { WebSocketTransport } from './lib/webSocketTransport';
import { useProjectStore } from './stores/useProjectStore';
import { useTerminalStore, type TerminalInfo } from './stores/useTerminalStore';
import { applyLiveUIStateSnapshot, useUIStore } from './stores/useUIStore';
import { IPC, type WebSessionState, type WorkspaceProject } from '../shared/ipcChannels';
import {
  type ThemeDefinition,
  type ThemeTokens,
  THEME_CLASSIC_AMBER,
  TOKEN_TO_CSS,
  getThemeById,
} from '../shared/themeTypes';
import './styles/globals.css';

// Global error handlers
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[Global]', message, { source, lineno, colno, error });
};
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise]', event.reason);
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const LAST_PROJECT_KEY = 'subframe-last-project';
const SESSION_KEY = 'subframe-terminal-sessions';
const GLOBAL_PROJECT = '__global__';
const WEB_SESSION_TOKEN_KEY_PREFIX = 'subframe-web-token';

interface WebBootstrapData {
  workspaceName: string;
  projectName: string | null;
  appearance: {
    activeThemeId: string;
    customThemes: ThemeDefinition[];
    enableNeonTraces?: boolean;
    enableScanlines?: boolean;
    enableLogoGlow?: boolean;
  };
}

function applyThemeAppearance(appearance?: WebBootstrapData['appearance'] | null): ThemeTokens {
  const activeId = appearance?.activeThemeId || 'classic-amber';
  const customThemes = appearance?.customThemes || [];
  const theme = getThemeById(activeId, customThemes) ?? THEME_CLASSIC_AMBER;
  const tokens = theme.tokens;
  const root = document.documentElement;
  const entries = Object.entries(TOKEN_TO_CSS) as [keyof ThemeTokens, string | null][];

  for (const [tokenKey, cssVar] of entries) {
    if (!cssVar) continue;
    const value = tokens[tokenKey];
    if (typeof value === 'string') {
      root.style.setProperty(cssVar, value);
    }
  }

  root.style.setProperty('--color-background', tokens.bgDeep);
  root.style.setProperty('--color-foreground', tokens.textPrimary);
  root.style.setProperty('--color-card', tokens.bgPrimary);
  root.style.setProperty('--color-card-foreground', tokens.textPrimary);
  root.style.setProperty('--color-popover', tokens.bgSecondary);
  root.style.setProperty('--color-popover-foreground', tokens.textPrimary);
  root.style.setProperty('--color-primary', tokens.accent);
  root.style.setProperty('--color-primary-foreground', tokens.bgDeep);
  root.style.setProperty('--color-secondary', tokens.bgTertiary);
  root.style.setProperty('--color-secondary-foreground', tokens.textPrimary);
  root.style.setProperty('--color-muted', tokens.bgTertiary);
  root.style.setProperty('--color-muted-foreground', tokens.textTertiary);
  root.style.setProperty('--color-accent-foreground', tokens.textPrimary);
  root.style.setProperty('--color-destructive', tokens.error);
  root.style.setProperty('--color-border', tokens.borderDefault);
  root.style.setProperty('--color-input', tokens.borderDefault);

  const neonTraces = appearance?.enableNeonTraces !== undefined
    ? !!appearance.enableNeonTraces
    : !!tokens.enableNeonTraces;
  const scanlines = appearance?.enableScanlines !== undefined
    ? !!appearance.enableScanlines
    : !!tokens.enableScanlines;
  const logoGlow = appearance?.enableLogoGlow !== undefined
    ? !!appearance.enableLogoGlow
    : !!tokens.enableLogoGlow;

  if (neonTraces) {
    root.style.setProperty('--color-ring', `color-mix(in srgb, ${tokens.neonPurple} 30%, transparent)`);
    root.style.setProperty('--color-accent', tokens.neonPurple);
    root.style.setProperty('--color-accent-subtle', `color-mix(in srgb, ${tokens.neonPurple} 15%, transparent)`);
    root.style.setProperty('--color-accent-glow', `color-mix(in srgb, ${tokens.neonPurple} 12%, transparent)`);
    root.style.setProperty('--color-primary', tokens.neonPurple);
    root.style.setProperty('--shadow-glow', `0 0 20px color-mix(in srgb, ${tokens.neonPurple} 15%, transparent)`);
  } else {
    root.style.setProperty('--color-ring', `color-mix(in srgb, ${tokens.accent} 30%, transparent)`);
    root.style.setProperty('--color-accent', tokens.accent);
    root.style.setProperty('--color-accent-subtle', tokens.accentSubtle);
    root.style.setProperty('--color-accent-glow', tokens.accentGlow);
    root.style.setProperty('--shadow-glow', `0 0 20px ${tokens.accentGlow}`);
  }

  if (neonTraces) root.setAttribute('data-neon-traces', '');
  else root.removeAttribute('data-neon-traces');

  if (scanlines) root.setAttribute('data-scanlines', '');
  else root.removeAttribute('data-scanlines');

  if (logoGlow) root.setAttribute('data-logo-glow', '');
  else root.removeAttribute('data-logo-glow');

  return tokens;
}

// ── Connection UI ─────────────────────────────────────────────────────────

function ConnectingScreen({ message, theme, detail }: { message: string; theme: ThemeTokens; detail?: string | null }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh',
      background: `radial-gradient(circle at top, ${theme.accentGlow} 0%, ${theme.bgPrimary} 22%, ${theme.bgDeep} 70%)`,
      color: theme.textPrimary,
      fontFamily: 'system-ui',
    }}>
      <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>SubFrame</div>
      <div style={{ fontSize: 14, color: theme.textSecondary }}>{message}</div>
      {detail && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 8 }}>{detail}</div>}
    </div>
  );
}

function AccessScreen({
  host,
  mode,
  pairCode,
  token,
  busy,
  error,
  onModeChange,
  onPairCodeChange,
  onTokenChange,
  onPair,
  onTokenSubmit,
  theme,
  workspaceName,
  projectName,
}: {
  host: string;
  mode: 'pair' | 'token';
  pairCode: string;
  token: string;
  busy: boolean;
  error: string | null;
  onModeChange: (mode: 'pair' | 'token') => void;
  onPairCodeChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onPair: () => void;
  onTokenSubmit: () => void;
  theme: ThemeTokens;
  workspaceName?: string | null;
  projectName?: string | null;
}) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `radial-gradient(circle at top, ${theme.accentGlow} 0%, ${theme.bgPrimary} 35%, ${theme.bgDeep} 100%)`,
      color: theme.textPrimary,
      fontFamily: 'system-ui',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        borderRadius: 18,
        border: `1px solid ${theme.borderDefault}`,
        background: theme.bgPrimary,
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
        padding: 22,
      }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>SubFrame</div>
        <div style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
          Connect to <span style={{ color: theme.textPrimary }}>{host}</span> by entering a pairing code from the desktop app or pasting a session token.
        </div>
        {(workspaceName || projectName) && (
          <div style={{
            marginBottom: 18,
            borderRadius: 10,
            border: `1px solid ${theme.borderSubtle}`,
            background: theme.bgSecondary,
            color: theme.textMuted,
            padding: '10px 12px',
            fontSize: 12,
            lineHeight: 1.5,
          }}>
            Ready to mirror {workspaceName || 'Workspace'}
            {projectName ? ` / ${projectName}` : ''}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => onModeChange('pair')}
            style={{
              flex: 1,
              borderRadius: 10,
              border: mode === 'pair' ? `1px solid ${theme.accent}` : `1px solid ${theme.borderSubtle}`,
              background: mode === 'pair' ? theme.accentSubtle : theme.bgSecondary,
              color: theme.textPrimary,
              padding: '10px 12px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Pair With Code
          </button>
          <button
            onClick={() => onModeChange('token')}
            style={{
              flex: 1,
              borderRadius: 10,
              border: mode === 'token' ? `1px solid ${theme.accent}` : `1px solid ${theme.borderSubtle}`,
              background: mode === 'token' ? theme.accentSubtle : theme.bgSecondary,
              color: theme.textPrimary,
              padding: '10px 12px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Enter Token
          </button>
        </div>

        {mode === 'pair' ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onPair();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <label style={{ fontSize: 12, color: theme.textTertiary }}>Pairing Code</label>
            <input
              value={pairCode}
              onChange={(event) => onPairCodeChange(event.target.value)}
              placeholder="ABC123"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              style={{
                width: '100%',
                borderRadius: 10,
                border: `1px solid ${theme.borderDefault}`,
                background: theme.bgDeep,
                color: theme.textPrimary,
                padding: '12px 14px',
                fontSize: 18,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: 700,
                textAlign: 'center',
              }}
            />
            <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.5 }}>
              In SubFrame desktop, open Settings → Integrations → SubFrame Server, then choose <span style={{ color: theme.textPrimary }}>Generate + Copy Code</span>.
            </div>
            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: 4,
                borderRadius: 10,
                border: 'none',
                background: theme.accent,
                color: theme.bgDeep,
                padding: '11px 14px',
                cursor: busy ? 'default' : 'pointer',
                fontSize: 14,
                fontWeight: 700,
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? 'Connecting...' : 'Pair and Connect'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onTokenSubmit();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <label style={{ fontSize: 12, color: theme.textTertiary }}>Session Token</label>
            <textarea
              value={token}
              onChange={(event) => onTokenChange(event.target.value)}
              placeholder="Paste the SubFrame session token"
              spellCheck={false}
              rows={3}
              style={{
                width: '100%',
                borderRadius: 10,
                border: `1px solid ${theme.borderDefault}`,
                background: theme.bgDeep,
                color: theme.textPrimary,
                padding: '12px 14px',
                fontSize: 13,
                lineHeight: 1.5,
                resize: 'vertical',
              }}
            />
            <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.5 }}>
              Use this if you copied a token manually or opened a direct connection link earlier.
            </div>
            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: 4,
                borderRadius: 10,
                border: 'none',
                background: theme.accent,
                color: theme.bgDeep,
                padding: '11px 14px',
                cursor: busy ? 'default' : 'pointer',
                fontSize: 14,
                fontWeight: 700,
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? 'Connecting...' : 'Connect With Token'}
            </button>
          </form>
        )}

        {error && (
          <div style={{
            marginTop: 14,
            borderRadius: 10,
            border: `1px solid ${theme.error}`,
            background: `color-mix(in srgb, ${theme.error} 10%, ${theme.bgPrimary})`,
            color: theme.textPrimary,
            padding: '10px 12px',
            fontSize: 12,
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionTakeoverScreen({ currentDevice, connectedAt, onTakeover, theme }: {
  currentDevice: string;
  connectedAt: string;
  onTakeover: () => void;
  theme: ThemeTokens;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh',
      background: `radial-gradient(circle at top, ${theme.accentGlow} 0%, ${theme.bgPrimary} 22%, ${theme.bgDeep} 70%)`,
      color: theme.textPrimary,
      fontFamily: 'system-ui',
      gap: 16,
    }}>
      <div style={{ fontSize: 24, fontWeight: 600 }}>Session In Use</div>
      <div style={{ fontSize: 14, color: theme.textSecondary, textAlign: 'center', maxWidth: 400 }}>
        SubFrame is currently connected from another device.
        <br />
        <span style={{ fontSize: 12, color: theme.textMuted }}>{currentDevice} — since {new Date(connectedAt).toLocaleString()}</span>
      </div>
      <button
        onClick={onTakeover}
        style={{
          marginTop: 8, padding: '10px 24px', background: theme.accent, color: theme.bgDeep,
          border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600,
        }}
      >
        Take Over Session
      </button>
    </div>
  );
}

function DisconnectedScreen({ theme }: { theme: ThemeTokens }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `color-mix(in srgb, ${theme.bgDeep} 88%, transparent)`,
      zIndex: 99999,
      color: theme.textPrimary,
      fontFamily: 'system-ui',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Reconnecting...</div>
        <div style={{ fontSize: 13, color: theme.textSecondary }}>Connection to SubFrame lost. Retrying automatically.</div>
      </div>
    </div>
  );
}

function getWebTokenStorageKey(): string {
  return `${WEB_SESSION_TOKEN_KEY_PREFIX}:${window.location.host}`;
}

function loadStoredWebToken(): string {
  try {
    return sessionStorage.getItem(getWebTokenStorageKey()) ?? '';
  } catch {
    return '';
  }
}

function storeWebToken(token: string): void {
  try {
    sessionStorage.setItem(getWebTokenStorageKey(), token);
  } catch {
    // ignore
  }
}

function clearStoredWebToken(): void {
  try {
    sessionStorage.removeItem(getWebTokenStorageKey());
  } catch {
    // ignore
  }
}

function isTokenError(message: string): boolean {
  return /invalid token|token regenerated/i.test(message);
}

async function exchangePairingCode(code: string): Promise<string> {
  const response = await fetch('/api/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  const payload = await response.json().catch(() => ({ error: 'Invalid server response' })) as {
    token?: string;
    error?: string;
  };

  if (!response.ok || !payload.token) {
    throw new Error(payload.error || 'Failed to pair with SubFrame');
  }

  return payload.token;
}

function getManualProjects(projects: WorkspaceProject[]): WorkspaceProject[] {
  return projects.filter((project) => (project as WorkspaceProject & { source?: string }).source !== 'scanned');
}

function deriveCurrentProjectPath(snapshot: WebSessionState): string | null {
  if (snapshot.currentProjectPath) return snapshot.currentProjectPath;
  const firstTerminalProject = snapshot.terminals.find((terminal) => terminal.projectPath)?.projectPath;
  if (firstTerminalProject) return firstTerminalProject;
  const manualProjects = getManualProjects(snapshot.projects);
  return manualProjects[0]?.path ?? snapshot.projects[0]?.path ?? null;
}

function buildFallbackSession(snapshot: WebSessionState, currentProjectPath: string | null): NonNullable<WebSessionState['session']> {
  const normalizedPath = currentProjectPath ?? '';
  const projectTerminals = snapshot.terminals.filter((terminal) => (terminal.projectPath ?? '') === normalizedPath);
  const terminalNames: Record<string, string> = {};
  const terminalCwds: Record<string, string> = {};
  const terminalShells: Record<string, string> = {};
  const terminalSessionIds: Record<string, string> = {};

  projectTerminals.forEach((terminal, index) => {
    terminalNames[terminal.id] = `Terminal ${index + 1}`;
    if (terminal.cwd) terminalCwds[terminal.id] = terminal.cwd;
    if (terminal.shell) terminalShells[terminal.id] = terminal.shell;
    if (terminal.sessionId) terminalSessionIds[terminal.id] = terminal.sessionId;
  });

  return {
    viewMode: 'tabs',
    activeTerminalId: projectTerminals[projectTerminals.length - 1]?.id ?? null,
    terminalNames,
    tabOrder: projectTerminals.map((terminal) => terminal.id),
    terminalCwds: Object.keys(terminalCwds).length > 0 ? terminalCwds : undefined,
    terminalShells: Object.keys(terminalShells).length > 0 ? terminalShells : undefined,
    terminalSessionIds: Object.keys(terminalSessionIds).length > 0 ? terminalSessionIds : undefined,
  };
}

function persistHydratedSession(
  currentProjectPath: string | null,
  currentProject: WorkspaceProject | undefined,
  session: NonNullable<WebSessionState['session']>,
) {
  const sessionKey = currentProjectPath ?? GLOBAL_PROJECT;
  try {
    const existingSessions = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    existingSessions[sessionKey] = session;
    localStorage.setItem(SESSION_KEY, JSON.stringify(existingSessions));
  } catch {
    // ignore
  }

  try {
    localStorage.setItem(LAST_PROJECT_KEY, JSON.stringify({
      path: currentProjectPath,
      isFrame: currentProject?.isFrameProject ?? false,
    }));
  } catch {
    // ignore
  }
}

function hydrateProjectStore(snapshot: WebSessionState, currentProjectPath: string | null) {
  const manualProjects = getManualProjects(snapshot.projects);
  const currentProject = snapshot.projects.find((project) => project.path === currentProjectPath);
  const projectStore = useProjectStore.getState();

  projectStore.setWorkspaceName(snapshot.workspaceName);
  projectStore.setProjects(manualProjects.map((project) => ({
    path: project.path,
    name: project.name,
    isFrameProject: project.isFrameProject ?? false,
    aiTool: project.aiTool,
  })));
  projectStore.setProject(currentProjectPath, currentProject?.isFrameProject ?? false);

  return currentProject;
}

function hydrateTerminalStore(
  snapshot: WebSessionState,
  currentProjectPath: string | null,
  session: NonNullable<WebSessionState['session']>,
) {
  const normalizedPath = currentProjectPath ?? '';
  const orderIndex = new Map((session.tabOrder ?? []).map((id, index) => [id, index]));
  const countsByProject = new Map<string, number>();
  const fallbackActiveByProject = new Map<string, string>();
  const terminals = new Map<string, TerminalInfo>();
  let createdAtCounter = (session.tabOrder?.length ?? 0) + 1;

  snapshot.terminals.forEach((terminal) => {
    const projectPath = terminal.projectPath ?? '';
    const currentCount = (countsByProject.get(projectPath) ?? 0) + 1;
    countsByProject.set(projectPath, currentCount);

    const createdAt = projectPath === normalizedPath && orderIndex.has(terminal.id)
      ? (orderIndex.get(terminal.id) ?? 0) + 1
      : createdAtCounter++;

    const fallbackName = `Terminal ${currentCount}`;
    const name = projectPath === normalizedPath
      ? session.terminalNames[terminal.id] ?? fallbackName
      : fallbackName;

    terminals.set(terminal.id, {
      id: terminal.id,
      name,
      nameSource: projectPath === normalizedPath
        ? session.terminalNameSources?.[terminal.id] ?? 'default'
        : 'default',
      projectPath,
      isActive: false,
      createdAt,
      claudeActive: terminal.claudeActive,
      claudeSessionId: terminal.sessionId ?? undefined,
    });

    fallbackActiveByProject.set(projectPath, terminal.id);
  });

  const activeByProject = new Map(fallbackActiveByProject);
  const sessionActiveTerminal = session.activeTerminalId && terminals.has(session.activeTerminalId)
    ? session.activeTerminalId
    : null;
  if (sessionActiveTerminal) {
    activeByProject.set(normalizedPath, sessionActiveTerminal);
  }

  const gridSlotsByProject = new Map(useTerminalStore.getState().gridSlotsByProject);
  if (session.gridSlots) {
    gridSlotsByProject.set(normalizedPath, session.gridSlots);
  } else {
    gridSlotsByProject.delete(normalizedPath);
  }

  useTerminalStore.setState((state) => ({
    terminals,
    activeTerminalId: sessionActiveTerminal ?? activeByProject.get(normalizedPath) ?? null,
    activeByProject,
    viewMode: session.viewMode ?? state.viewMode,
    gridLayout: (session.gridLayout as typeof state.gridLayout | undefined) ?? state.gridLayout,
    maximizedTerminalId: session.maximizedTerminalId ?? null,
    gridSlots: session.gridSlots ?? [],
    gridSlotsByProject,
  }));
}

function applyLiveSessionSync(payload: {
  currentProjectPath?: string | null;
  session?: WebSessionState['session'];
  ui?: WebSessionState['ui'];
}) {
  const projectStore = useProjectStore.getState();
  const terminalStore = useTerminalStore.getState();
  const uiStore = useUIStore.getState();

  const nextProjectPath = payload.currentProjectPath ?? projectStore.currentProjectPath;
  const normalizedPath = nextProjectPath ?? '';

  if ('currentProjectPath' in payload) {
    const nextProject = projectStore.projects.find((project) => project.path === nextProjectPath);
    projectStore.setProject(nextProjectPath, nextProject?.isFrameProject ?? false);
  }

  if ('ui' in payload) {
    if (payload.ui) {
      applyLiveUIStateSnapshot(payload.ui);
    } else {
      uiStore.closeRightPanel();
      uiStore.setSettingsOpen(false);
      uiStore.setShortcutsHelpOpen(false);
      uiStore.setFullViewContent(null);
    }
  }

  const session = payload.session;
  if (!session) return;

  const terminals = new Map(terminalStore.terminals);
  for (const [id, info] of terminals) {
    if ((info.projectPath || '') !== normalizedPath) continue;
    const nextName = session.terminalNames[id];
    if (!nextName) continue;
    terminals.set(id, {
      ...info,
      name: nextName,
      nameSource: session.terminalNameSources?.[id] ?? info.nameSource ?? 'default',
    });
  }

  const activeByProject = new Map(terminalStore.activeByProject);
  if (session.activeTerminalId && terminals.has(session.activeTerminalId)) {
    activeByProject.set(normalizedPath, session.activeTerminalId);
  }

  const gridSlotsByProject = new Map(terminalStore.gridSlotsByProject);
  if (session.gridSlots) {
    gridSlotsByProject.set(normalizedPath, session.gridSlots);
  }

  if (session.tabOrder && session.tabOrder.length > 0) {
    let createdAt = 1;
    for (const id of session.tabOrder) {
      const info = terminals.get(id);
      if (!info) continue;
      terminals.set(id, { ...info, createdAt: createdAt++ });
    }
  }

  useTerminalStore.setState({
    terminals,
    activeByProject,
    activeTerminalId: normalizedPath === (projectStore.currentProjectPath ?? '')
      ? (session.activeTerminalId && terminals.has(session.activeTerminalId)
          ? session.activeTerminalId
          : terminalStore.activeTerminalId)
      : terminalStore.activeTerminalId,
    viewMode: session.viewMode ?? terminalStore.viewMode,
    gridLayout: (session.gridLayout as typeof terminalStore.gridLayout | undefined) ?? terminalStore.gridLayout,
    maximizedTerminalId: session.maximizedTerminalId ?? terminalStore.maximizedTerminalId,
    gridSlots: session.gridSlots ?? terminalStore.gridSlots,
    gridSlotsByProject,
  });
}

async function hydrateLiveSession(transport: WebSocketTransport) {
  const snapshot = await transport.invoke(IPC.WEB_SESSION_STATE);
  const currentProjectPath = deriveCurrentProjectPath(snapshot);
  const currentProject = hydrateProjectStore(snapshot, currentProjectPath);
  const session = snapshot.session ?? buildFallbackSession(snapshot, currentProjectPath);

  persistHydratedSession(currentProjectPath, currentProject, session);
  hydrateTerminalStore(snapshot, currentProjectPath, session);

  const uiStore = useUIStore.getState();
  if (snapshot.ui) {
    applyLiveUIStateSnapshot(snapshot.ui);
  } else {
    uiStore.closeRightPanel();
    uiStore.setSettingsOpen(false);
    uiStore.setShortcutsHelpOpen(false);
    uiStore.setFullViewContent(null);
  }
}

function WebClientRoot() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const queryToken = (params.get('token') || '').trim();
  const storedToken = loadStoredWebToken();
  const initialToken = queryToken || storedToken;
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

  const [mode, setMode] = useState<'pair' | 'token'>(initialToken ? 'token' : 'pair');
  const [pairCode, setPairCode] = useState('');
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [activeToken, setActiveToken] = useState(initialToken);
  const [screen, setScreen] = useState<'access' | 'connecting' | 'session-in-use' | 'connected' | 'session-moved'>(
    initialToken ? 'connecting' : 'access'
  );
  const [accessError, setAccessError] = useState<string | null>(null);
  const [sessionInUse, setSessionInUse] = useState<{ currentDevice: string; connectedAt: string } | null>(null);
  const [sessionMovedMessage, setSessionMovedMessage] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [bootstrapData, setBootstrapData] = useState<WebBootstrapData | null>(null);
  const [screenTheme, setScreenTheme] = useState<ThemeTokens>(THEME_CLASSIC_AMBER.tokens);
  const transportRef = useRef<WebSocketTransport | null>(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    let notificationPermissionRequested = false;
    const requestNotificationPermission = () => {
      if (notificationPermissionRequested) return;
      notificationPermissionRequested = true;
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    };

    window.addEventListener('click', requestNotificationPermission, { once: true });
    window.addEventListener('keypress', requestNotificationPermission, { once: true });

    return () => {
      window.removeEventListener('click', requestNotificationPermission);
      window.removeEventListener('keypress', requestNotificationPermission);
    };
  }, []);

  useEffect(() => {
    setScreenTheme(applyThemeAppearance(null));
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/bootstrap', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Bootstrap request failed: ${response.status}`);
        return response.json() as Promise<WebBootstrapData>;
      })
      .then((data) => {
        if (cancelled) return;
        setBootstrapData(data);
        setScreenTheme(applyThemeAppearance(data.appearance));
      })
      .catch(() => {
        if (cancelled) return;
        setScreenTheme(applyThemeAppearance(null));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeToken) return;

    setScreen('connecting');
    setAccessError(null);
    setDisconnected(false);
    setSessionInUse(null);
    setSessionMovedMessage(null);

    const transport = new WebSocketTransport({
      url: wsUrl,
      token: activeToken,
      onNotification: (title, body, tag) => {
        if (!document.hidden) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const sw = navigator.serviceWorker?.controller;
        if (sw) {
          sw.postMessage({ type: 'show-notification', title, body, tag });
        }
      },
      onSessionTakeover: (message) => {
        connectedRef.current = false;
        setDisconnected(false);
        setSessionMovedMessage(message);
        setScreen('session-moved');
      },
      onSessionInUse: (currentDevice, connectedAt) => {
        setSessionInUse({ currentDevice, connectedAt });
        setScreen('session-in-use');
      },
      onDisconnect: () => {
        if (connectedRef.current) {
          setDisconnected(true);
        }
      },
      onReconnect: () => {
        if (connectedRef.current) {
          setDisconnected(false);
        }
      },
    });

    transportRef.current?.dispose();
    transportRef.current = transport;
    // Suppress live sync for the first 1.5s after connect to avoid sidebar/panel flashing
    // during initial hydration. The full state is loaded via hydrateLiveSession instead.
    let syncReady = false;
    const syncReadyTimer = setTimeout(() => { syncReady = true; }, 1500);
    const unsubscribeSessionSync = transport.on(IPC.WEB_SESSION_SYNC, (_event, payload) => {
      if (!syncReady) return;
      if (!payload || typeof payload !== 'object') return;
      const data = payload as {
        origin?: 'electron' | 'web';
        currentProjectPath?: string | null;
        session?: WebSessionState['session'];
        ui?: WebSessionState['ui'];
      };
      if (data.origin === 'web') return;
      applyLiveSessionSync(data);
    });

    let cancelled = false;

    transport.connect()
      .then(() => {
        if (cancelled) return;
        setTransport(transport);
        return hydrateLiveSession(transport).catch((err) => {
          console.warn('[Web] Failed to hydrate live session:', err);
        });
      })
      .then(() => {
        if (cancelled) return;
        connectedRef.current = true;
        storeWebToken(activeToken);
        if (queryToken) {
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
        }
        setScreen('connected');
      })
      .catch((err) => {
        if (cancelled) return;
        connectedRef.current = false;
        transport.dispose();
        if (transportRef.current === transport) {
          transportRef.current = null;
        }

        const message = err instanceof Error ? err.message : String(err);
        if (isTokenError(message)) {
          clearStoredWebToken();
        }

        setTokenInput(activeToken);
        setActiveToken('');
        setMode('token');
        setAccessError(message);
        setScreen('access');
      });

    return () => {
      cancelled = true;
      connectedRef.current = false;
      clearTimeout(syncReadyTimer);
      unsubscribeSessionSync();
      if (transportRef.current === transport) {
        transportRef.current = null;
      }
      transport.dispose();
    };
  }, [activeToken, queryToken, wsUrl]);

  const submitToken = () => {
    const nextToken = tokenInput.trim();
    if (!nextToken) {
      setAccessError('Enter a session token to continue.');
      return;
    }

    setAccessError(null);
    setMode('token');
    setActiveToken(nextToken);
  };

  const submitPairCode = async () => {
    const normalizedCode = pairCode.trim().toUpperCase();
    if (!normalizedCode) {
      setAccessError('Enter the pairing code shown in SubFrame desktop.');
      return;
    }

    setScreen('connecting');
    setAccessError(null);

    try {
      const token = await exchangePairingCode(normalizedCode);
      setTokenInput(token);
      setActiveToken(token);
      setMode('token');
    } catch (err) {
      setScreen('access');
      setAccessError(err instanceof Error ? err.message : 'Failed to pair with SubFrame');
    }
  };

  if (screen === 'session-in-use' && sessionInUse) {
    return (
      <SessionTakeoverScreen
        currentDevice={sessionInUse.currentDevice}
        connectedAt={sessionInUse.connectedAt}
        theme={screenTheme}
        onTakeover={() => {
          setScreen('connecting');
          transportRef.current?.requestTakeover();
        }}
      />
    );
  }

  if (screen === 'connected') {
    return (
      <>
        <ErrorBoundary name="SubFrame">
          <QueryClientProvider client={queryClient}>
            <App />
            <Toaster position="bottom-right" theme="dark" />
          </QueryClientProvider>
        </ErrorBoundary>
        {disconnected && <DisconnectedScreen theme={screenTheme} />}
      </>
    );
  }

  if (screen === 'session-moved') {
    return (
      <ConnectingScreen
        message={sessionMovedMessage || 'Session moved to another device.'}
        detail={bootstrapData ? `Mirror target: ${bootstrapData.workspaceName}${bootstrapData.projectName ? ` / ${bootstrapData.projectName}` : ''}` : null}
        theme={screenTheme}
      />
    );
  }

  if (screen === 'connecting') {
    return (
      <ConnectingScreen
        message="Connecting to SubFrame..."
        detail={bootstrapData ? `Preparing ${bootstrapData.workspaceName}${bootstrapData.projectName ? ` / ${bootstrapData.projectName}` : ''}` : null}
        theme={screenTheme}
      />
    );
  }

  return (
    <AccessScreen
      host={window.location.host}
      mode={mode}
      pairCode={pairCode}
      token={tokenInput}
      busy={screen === 'connecting'}
      error={accessError}
      onModeChange={setMode}
      onPairCodeChange={(value) => setPairCode(value.toUpperCase())}
      onTokenChange={setTokenInput}
      onPair={() => {
        void submitPairCode();
      }}
      onTokenSubmit={submitToken}
      theme={screenTheme}
      workspaceName={bootstrapData?.workspaceName}
      projectName={bootstrapData?.projectName}
    />
  );
}

// ── Bootstrap ─────────────────────────────────────────────────────────────

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<WebClientRoot />);
}
