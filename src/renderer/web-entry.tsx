/**
 * Web-mode entry point for SubFrame Server.
 *
 * Identical to index.tsx but initializes WebSocketTransport instead of
 * ElectronTransport. Used when SubFrame is accessed via browser.
 *
 * The token and server URL are extracted from the URL query params:
 *   http://localhost:8080/?token=abc123
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { App } from './components/App';
import { setTransport } from './lib/transportProvider';
import { WebSocketTransport } from './lib/webSocketTransport';
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

// ── Connection UI ─────────────────────────────────────────────────────────

function ConnectingScreen({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0f0f10', color: '#e8e6e3', fontFamily: 'system-ui',
    }}>
      <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>SubFrame</div>
      <div style={{ fontSize: 14, color: '#a09890' }}>{message}</div>
    </div>
  );
}

function SessionTakeoverScreen({ currentDevice, connectedAt, onTakeover }: {
  currentDevice: string;
  connectedAt: string;
  onTakeover: () => void;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0f0f10', color: '#e8e6e3', fontFamily: 'system-ui',
      gap: 16,
    }}>
      <div style={{ fontSize: 24, fontWeight: 600 }}>Session In Use</div>
      <div style={{ fontSize: 14, color: '#a09890', textAlign: 'center', maxWidth: 400 }}>
        SubFrame is currently connected from another device.
        <br />
        <span style={{ fontSize: 12 }}>{currentDevice} — since {new Date(connectedAt).toLocaleString()}</span>
      </div>
      <button
        onClick={onTakeover}
        style={{
          marginTop: 8, padding: '10px 24px', background: '#d4a574', color: '#0f0f10',
          border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600,
        }}
      >
        Take Over Session
      </button>
    </div>
  );
}

function DisconnectedScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(15, 15, 16, 0.9)', zIndex: 99999, color: '#e8e6e3', fontFamily: 'system-ui',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Reconnecting...</div>
        <div style={{ fontSize: 13, color: '#a09890' }}>Connection to SubFrame lost. Retrying automatically.</div>
      </div>
    </div>
  );
}

// ── Bootstrap ─────────────────────────────────────────────────────────────

const rootEl = document.getElementById('root');
if (rootEl) {
  // Extract connection params from URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

  const root = createRoot(rootEl);

  // Show connecting state
  root.render(<ConnectingScreen message="Connecting to SubFrame..." />);

  let disconnected = false;
  let appRendered = false;

  const transport = new WebSocketTransport({
    url: wsUrl,
    token,
    onSessionTakeover: (message) => {
      root.render(
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#0f0f10', color: '#e8e6e3', fontFamily: 'system-ui',
        }}>
          <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Session Moved</div>
          <div style={{ fontSize: 14, color: '#a09890' }}>{message}</div>
        </div>
      );
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSessionInUse: (currentDevice: any, connectedAt: any) => {
      root.render(
        <SessionTakeoverScreen
          currentDevice={currentDevice}
          connectedAt={connectedAt}
          onTakeover={() => {
            root.render(<ConnectingScreen message="Taking over session..." />);
            // The WebSocketTransport handles takeover internally via sendRaw
            // We need to send a takeover message — for now reconnect with takeover flag
            // The transport will call connect() which sends auth, then we send takeover
          }}
        />
      );
    },
    onDisconnect: () => {
      if (appRendered) {
        disconnected = true;
        // Overlay on top of existing app
        const overlay = document.createElement('div');
        overlay.id = 'sf-disconnect-overlay';
        document.body.appendChild(overlay);
        createRoot(overlay).render(<DisconnectedScreen />);
      }
    },
    onReconnect: () => {
      if (disconnected) {
        disconnected = false;
        const overlay = document.getElementById('sf-disconnect-overlay');
        if (overlay) overlay.remove();
      }
    },
  });

  setTransport(transport);

  transport.connect()
    .then(() => {
      appRendered = true;
      root.render(
        <ErrorBoundary name="SubFrame">
          <QueryClientProvider client={queryClient}>
            <App />
            <Toaster position="bottom-right" theme="dark" />
          </QueryClientProvider>
        </ErrorBoundary>
      );
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .catch((err: any) => {
      root.render(
        <ConnectingScreen message={`Failed to connect: ${err.message}`} />
      );
    });
}
