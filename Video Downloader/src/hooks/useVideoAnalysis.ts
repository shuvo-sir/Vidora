import { useCallback, useEffect, useRef, useState } from 'react';

import { analyzeVideoUrl } from '@/src/features/downloader/analysis-service';
import type { AnalysisResult } from '@/src/features/downloader/downloader-types';

export function useVideoAnalysis(initialUrl = '') {
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setInputUrl('');
    setResult(null);
    setLoading(false);
    setError(null);
  }, []);

  const setInputUrlAndClearResult = useCallback((value: string) => {
    setInputUrl(value);
    setResult(null);
    setError(null);
  }, []);

  const analyze = useCallback(async (value = inputUrl) => {
    if (loading || controllerRef.current) return;

    setInputUrl(value);
    setLoading(true);
    setError(null);
    setResult(null);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const nextResult = await analyzeVideoUrl(value, controller.signal);
      if (!mountedRef.current) return;

      if (controller.signal.aborted) {
        setResult({
          status: 'failed',
          requiresRightsConfirmation: true,
          errorCode: 'cancelled',
          message: 'Analysis cancelled.',
        });
      } else {
        setResult(nextResult);
      }
    } catch (caught) {
      if (mountedRef.current) {
        setError(caught instanceof Error ? caught.message : 'Analysis failed.');
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (mountedRef.current) setLoading(false);
    }
  }, [inputUrl, loading]);

  return {
    inputUrl,
    setInputUrl: setInputUrlAndClearResult,
    result,
    loading,
    error,
    analyze,
    reset,
    cancel,
  };
}
