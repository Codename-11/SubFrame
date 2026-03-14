import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { App } from './components/App';
import './styles/globals.css';

// Global error handlers — surface errors that React can't catch
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

// Detect pop-out mode from URL hash
const hash = window.location.hash;
const isPopoutStandby = hash === '#popout-standby';
const popoutParams = !isPopoutStandby && hash.startsWith('#popout?')
  ? new URLSearchParams(hash.replace('#popout?', ''))
  : null;
const popoutTerminalId = popoutParams?.get('terminalId') ?? null;
const isPopout = isPopoutStandby || !!popoutTerminalId;

const rootEl = document.getElementById('root');
if (rootEl) {
  if (isPopout) {
    // Pop-out mode — render minimal terminal window
    // terminalId is null for prewarmed standby windows (activates via IPC)
    const { PopoutTerminal } = require('./components/PopoutTerminal');
    createRoot(rootEl).render(
      <ErrorBoundary name="PopoutTerminal">
        <QueryClientProvider client={queryClient}>
          <PopoutTerminal terminalId={popoutTerminalId ?? undefined} />
          <Toaster position="bottom-right" theme="dark" />
        </QueryClientProvider>
      </ErrorBoundary>
    );
  } else {
    // Normal mode — render full app
    createRoot(rootEl).render(
      <ErrorBoundary name="SubFrame">
        <QueryClientProvider client={queryClient}>
          <App />
          <Toaster position="bottom-right" theme="dark" />
        </QueryClientProvider>
      </ErrorBoundary>
    );
  }
}
