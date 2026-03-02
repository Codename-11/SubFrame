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
      staleTime: 5000,
      retry: 1,
    },
  },
});

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <ErrorBoundary name="SubFrame">
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster position="bottom-right" theme="dark" />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
