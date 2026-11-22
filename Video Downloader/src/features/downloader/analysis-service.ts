import type { AnalysisResult } from './downloader-types';
import { analyzeWithSourceRegistry } from './source-registry';
import { validateVideoUrl } from './url-validator';

export const ANALYSIS_TIMEOUT_MS = 12_000;

export async function analyzeVideoUrl(
  value: string,
  externalSignal: AbortSignal
): Promise<AnalysisResult> {
  const validation = validateVideoUrl(value);
  if (!validation.valid) {
    return {
      status: 'failed',
      requiresRightsConfirmation: true,
      errorCode: validation.errorCode,
      message: validation.message,
    };
  }

  const timeoutController = new AbortController();
  let timedOut = false;
  const abortFromExternal = () => timeoutController.abort();
  externalSignal.addEventListener('abort', abortFromExternal, { once: true });

  if (externalSignal.aborted) timeoutController.abort();

  const timeout = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, ANALYSIS_TIMEOUT_MS);

  try {
    return await analyzeWithSourceRegistry(
      validation.url,
      timeoutController.signal
    );
  } catch {
    if (timeoutController.signal.aborted) {
      return {
        status: 'failed',
        requiresRightsConfirmation: true,
        errorCode: externalSignal.aborted ? 'cancelled' : 'timeout',
        message: externalSignal.aborted
          ? 'Analysis cancelled.'
          : 'The server took too long to respond. Please try again.',
      };
    }
    if (timedOut) {
      return {
        status: 'failed',
        requiresRightsConfirmation: true,
        errorCode: 'timeout',
        message: 'The server took too long to respond. Please try again.',
      };
    }
    return {
      status: 'failed',
      requiresRightsConfirmation: true,
      errorCode: 'network',
      message: 'The server could not be reached. Check the network and try again.',
    };
  } finally {
    clearTimeout(timeout);
    externalSignal.removeEventListener('abort', abortFromExternal);
  }
}
