/**
 * ErrorBoundary — Catches React render errors and displays them
 * instead of silently unmounting the entire component tree.
 *
 * React 19 has no built-in error display for production builds.
 * Without an ErrorBoundary, render errors cause a blank/frozen UI
 * with zero user feedback. This component catches errors at key
 * boundaries and shows a recoverable error panel.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  /** Label shown in the error panel header (e.g. "Tasks Panel") */
  name?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ''}]`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-text-tertiary">
          <div className="max-w-md w-full rounded-lg border border-red-900/50 bg-red-950/20 p-4">
            <div className="text-xs font-semibold text-red-400 mb-1">
              {this.props.name ? `${this.props.name} — Error` : 'Render Error'}
            </div>
            <div className="text-xs text-red-300/80 font-mono break-all mb-3">
              {this.state.error.message}
            </div>
            <button
              onClick={this.handleRetry}
              className="px-3 py-1.5 rounded text-xs bg-bg-hover text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
