/**
 * React hook for onboarding IPC calls.
 * Wraps project intelligence detection, AI analysis, and import
 * using TanStack Query mutations and IPC event listeners.
 */

import { useState, useCallback, useEffect } from 'react';
import { useIpcMutation } from './useIpc';
import { useIPCEvent } from './useIPCListener';
import { IPC } from '../../shared/ipcChannels';
import { typedInvoke, typedSend } from '../lib/ipc';
import type {
  OnboardingDetectionResult,
  OnboardingAnalysisResult,
  OnboardingProgressEvent,
  OnboardingImportResult,
  OnboardingImportSelections,
  OnboardingAnalysisOptions,
  OnboardingSessionState,
} from '../../shared/ipcChannels';

export function useOnboarding(projectPath: string | null) {
  // ── Local state ──────────────────────────────────────────────────────────
  const [detection, setDetection] = useState<OnboardingDetectionResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<OnboardingAnalysisResult | null>(null);
  const [progress, setProgress] = useState<OnboardingProgressEvent | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [activityStreamId, setActivityStreamId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<OnboardingImportResult | null>(null);

  // Stall detection state
  const [stalled, setStalled] = useState(false);
  const [stallDurationMs, setStallDurationMs] = useState(0);

  // Timeout tracking from progress events
  const [timeoutMs, setTimeoutMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  // ── Mutations ────────────────────────────────────────────────────────────
  const detectMutation = useIpcMutation(IPC.DETECT_PROJECT_INTELLIGENCE);
  const analyzeMutation = useIpcMutation(IPC.RUN_ONBOARDING_ANALYSIS);
  const importMutation = useIpcMutation(IPC.IMPORT_ONBOARDING_RESULTS);
  const previewPromptMutation = useIpcMutation(IPC.GET_ONBOARDING_PROMPT_PREVIEW);
  const browseFilesMutation = useIpcMutation(IPC.BROWSE_ONBOARDING_FILES);

  const applySession = useCallback((session: OnboardingSessionState | null) => {
    if (!session) {
      setDetection(null);
      setAnalysisResult(null);
      setProgress(null);
      setTerminalId(null);
      setActivityStreamId(null);
      setIsAnalyzing(false);
      setError(null);
      setCancelled(null);
      setImportResult(null);
      setStalled(false);
      setStallDurationMs(0);
      setTimeoutMs(null);
      setElapsedMs(null);
      return;
    }

    setDetection(session.detection);
    setAnalysisResult(session.analysisResult);
    setProgress(session.progress);
    setTerminalId(session.terminalId);
    setActivityStreamId(session.activityStreamId);
    setError(session.error);
    setCancelled(session.cancelled);
    setImportResult(session.importResult);
    setIsAnalyzing(['detecting', 'gathering', 'analyzing', 'parsing', 'importing'].includes(session.status));
    setStalled(session.progress?.stalled ?? false);
    setStallDurationMs(session.progress?.stallDurationMs ?? 0);
    setTimeoutMs(session.progress?.timeoutMs ?? null);
    setElapsedMs(session.progress?.elapsedMs ?? null);
  }, []);

  const hydrate = useCallback(async (targetProjectPath: string): Promise<OnboardingSessionState | null> => {
    const session = await typedInvoke(IPC.GET_ONBOARDING_SESSION, targetProjectPath);
    applySession(session);
    return session;
  }, [applySession]);

  const clear = useCallback(async (targetProjectPath: string): Promise<void> => {
    await typedInvoke(IPC.CLEAR_ONBOARDING_SESSION, targetProjectPath);
    applySession(null);
  }, [applySession]);

  useEffect(() => {
    if (!projectPath) {
      applySession(null);
      return;
    }
    hydrate(projectPath).catch(() => {
      // Ignore hydration errors and preserve local mutation-driven flow.
    });
  }, [applySession, hydrate, projectPath]);

  // ── Progress event listener ──────────────────────────────────────────────
  useIPCEvent<OnboardingProgressEvent>(
    IPC.ONBOARDING_PROGRESS,
    useCallback((data: OnboardingProgressEvent) => {
      if (projectPath && data.projectPath !== projectPath) return;
      setProgress(data);

      // Capture terminalId as soon as it arrives (sent during 'analyzing' phase)
      if (data.terminalId) {
        setTerminalId(data.terminalId);
      }
      if (data.activityStreamId) {
        setActivityStreamId(data.activityStreamId);
      }

      // Track timeout info from progress events
      if (data.timeoutMs !== undefined) setTimeoutMs(data.timeoutMs);
      if (data.elapsedMs !== undefined) setElapsedMs(data.elapsedMs);

      // Track stall state — always clear on non-stall events (no-op if already false,
      // avoids stale closure issues from depending on `stalled` in this callback)
      if (data.stalled) {
        setStalled(true);
        setStallDurationMs(data.stallDurationMs ?? 0);
      } else {
        setStalled(false);
        setStallDurationMs(0);
      }

      if (data.phase === 'done') {
        setIsAnalyzing(false);
        setCancelled(null);
        // The 'done' phase message contains the stringified analysis results
        try {
          const parsed = JSON.parse(data.message) as OnboardingAnalysisResult;
          setAnalysisResult(parsed);
        } catch {
          // Message wasn't JSON — that's acceptable, results may come another way
        }
      } else if (data.phase === 'cancelled') {
        setIsAnalyzing(false);
        setError(null);
        setCancelled(data.message);
      } else if (data.phase === 'error') {
        setIsAnalyzing(false);
        setCancelled(null);
        setError(data.message);
      }
    }, [projectPath])
  );

  // ── Actions ──────────────────────────────────────────────────────────────

  const detect = useCallback(
    async (projectPath: string): Promise<OnboardingDetectionResult> => {
      setError(null);
      try {
        const result = await detectMutation.mutateAsync([projectPath]);
        setDetection(result);
        return result;
      } catch (err) {
        const msg = (err as Error).message || 'Detection failed unexpectedly';
        setError(msg);
        throw err;
      }
    },
    [detectMutation]
  );

  const analyze = useCallback(
    async (
      projectPath: string,
      options?: OnboardingAnalysisOptions
    ): Promise<{ terminalId: string; activityStreamId: string }> => {
      setError(null);
      setIsAnalyzing(true);
      setAnalysisResult(null);
      setProgress(null);
      setActivityStreamId(null);
      setCancelled(null);
      try {
        const result = await analyzeMutation.mutateAsync([projectPath, options]);
        setTerminalId(result.terminalId);
        setActivityStreamId(result.activityStreamId);
        return result;
      } catch (err) {
        setIsAnalyzing(false);
        const msg = (err as Error).message || 'Analysis failed unexpectedly';
        setError(msg);
        throw err;
      }
    },
    [analyzeMutation]
  );

  const importResults = useCallback(
    async (
      projectPath: string,
      results: OnboardingAnalysisResult,
      selections: OnboardingImportSelections
    ): Promise<OnboardingImportResult> => {
      setError(null);
      try {
        const result = await importMutation.mutateAsync([
          { projectPath, results, selections },
        ]);
        setImportResult(result);
        return result;
      } catch (err) {
        const msg = (err as Error).message || 'Import failed unexpectedly';
        setError(msg);
        throw err;
      }
    },
    [importMutation]
  );

  const previewPrompt = useCallback(
    async (projectPath: string, options?: OnboardingAnalysisOptions): Promise<{ prompt: string; contextSize: number }> => {
      return previewPromptMutation.mutateAsync([projectPath, options]);
    },
    [previewPromptMutation]
  );

  const browseFiles = useCallback(
    async (projectPath: string, type: 'file' | 'directory'): Promise<string[]> => {
      return browseFilesMutation.mutateAsync([projectPath, type]);
    },
    [browseFilesMutation]
  );

  const cancel = useCallback((projectPath: string): void => {
    typedSend(IPC.CANCEL_ONBOARDING_ANALYSIS, projectPath);
    setIsAnalyzing(false);
  }, []);

  const retry = useCallback((): void => {
    setAnalysisResult(null);
    setProgress(null);
    setTerminalId(null);
    setActivityStreamId(null);
    setIsAnalyzing(false);
    setError(null);
    setCancelled(null);
    setImportResult(null);
    setStalled(false);
    setStallDurationMs(0);
    setTimeoutMs(null);
    setElapsedMs(null);
  }, []);

  const reset = useCallback((): void => {
    setDetection(null);
    setAnalysisResult(null);
    setProgress(null);
    setTerminalId(null);
    setActivityStreamId(null);
    setIsAnalyzing(false);
    setError(null);
    setCancelled(null);
    setImportResult(null);
    setStalled(false);
    setStallDurationMs(0);
    setTimeoutMs(null);
    setElapsedMs(null);
  }, []);

  return {
    // Actions
    detect,
    analyze,
    importResults,
    cancel,
    previewPrompt,
    browseFiles,
    retry,
    reset,
    hydrate,
    clear,

    // State
    detection,
    analysisResult,
    progress,
    terminalId,
    activityStreamId,
    isDetecting: detectMutation.isPending,
    isAnalyzing,
    isImporting: importMutation.isPending,
    isPreviewingPrompt: previewPromptMutation.isPending,
    isBrowsingFiles: browseFilesMutation.isPending,
    error,
    cancelled,
    importResult,
    stalled,
    stallDurationMs,
    timeoutMs,
    elapsedMs,
  };
}
