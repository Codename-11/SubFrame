/**
 * React hook for onboarding IPC calls.
 * Wraps project intelligence detection, AI analysis, and import
 * using TanStack Query mutations and IPC event listeners.
 */

import { useState, useCallback } from 'react';
import { useIpcMutation } from './useIpc';
import { useIPCEvent } from './useIPCListener';
import { IPC } from '../../shared/ipcChannels';
import { typedSend } from '../lib/ipc';
import type {
  OnboardingDetectionResult,
  OnboardingAnalysisResult,
  OnboardingProgressEvent,
  OnboardingImportResult,
  OnboardingImportSelections,
} from '../../shared/ipcChannels';

export function useOnboarding() {
  // ── Local state ──────────────────────────────────────────────────────────
  const [detection, setDetection] = useState<OnboardingDetectionResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<OnboardingAnalysisResult | null>(null);
  const [progress, setProgress] = useState<OnboardingProgressEvent | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Mutations ────────────────────────────────────────────────────────────
  const detectMutation = useIpcMutation(IPC.DETECT_PROJECT_INTELLIGENCE);
  const analyzeMutation = useIpcMutation(IPC.RUN_ONBOARDING_ANALYSIS);
  const importMutation = useIpcMutation(IPC.IMPORT_ONBOARDING_RESULTS);

  // ── Progress event listener ──────────────────────────────────────────────
  useIPCEvent<OnboardingProgressEvent>(
    IPC.ONBOARDING_PROGRESS,
    useCallback((data: OnboardingProgressEvent) => {
      setProgress(data);

      if (data.phase === 'done') {
        setIsAnalyzing(false);
        // The 'done' phase message contains the stringified analysis results
        try {
          const parsed = JSON.parse(data.message) as OnboardingAnalysisResult;
          setAnalysisResult(parsed);
        } catch {
          // Message wasn't JSON — that's acceptable, results may come another way
        }
      } else if (data.phase === 'error') {
        setIsAnalyzing(false);
        setError(data.message);
      }
    }, [])
  );

  // ── Actions ──────────────────────────────────────────────────────────────

  const detect = useCallback(
    async (projectPath: string): Promise<OnboardingDetectionResult> => {
      setError(null);
      const result = await detectMutation.mutateAsync([projectPath]);
      setDetection(result);
      return result;
    },
    [detectMutation]
  );

  const analyze = useCallback(
    async (projectPath: string): Promise<{ terminalId: string }> => {
      setError(null);
      setIsAnalyzing(true);
      setAnalysisResult(null);
      setProgress(null);
      const result = await analyzeMutation.mutateAsync([projectPath]);
      setTerminalId(result.terminalId);
      return result;
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
      const result = await importMutation.mutateAsync([
        { projectPath, results, selections },
      ]);
      return result;
    },
    [importMutation]
  );

  const cancel = useCallback((projectPath: string): void => {
    typedSend(IPC.CANCEL_ONBOARDING_ANALYSIS, projectPath);
    setIsAnalyzing(false);
  }, []);

  const reset = useCallback((): void => {
    setDetection(null);
    setAnalysisResult(null);
    setProgress(null);
    setTerminalId(null);
    setIsAnalyzing(false);
    setError(null);
  }, []);

  return {
    // Actions
    detect,
    analyze,
    importResults,
    cancel,
    reset,

    // State
    detection,
    analysisResult,
    progress,
    terminalId,
    isDetecting: detectMutation.isPending,
    isAnalyzing,
    isImporting: importMutation.isPending,
    error,
  };
}
