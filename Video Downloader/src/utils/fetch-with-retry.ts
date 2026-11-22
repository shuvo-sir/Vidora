export type FetchWithRetryOptions = RequestInit & {
  timeoutMs?: number;
  retries?: number;
  onRetry?: (retryNumber: number) => void;
};

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 60_000,
    retries = 2,
    onRetry,
    signal: externalSignal,
    ...fetchOptions
  } = options;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;

    const abortFromExternal = () => controller.abort();
    externalSignal?.addEventListener('abort', abortFromExternal, { once: true });
    if (externalSignal?.aborted) controller.abort();

    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      return await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
    } catch (caught) {
      if (
        externalSignal?.aborted ||
        (caught instanceof DOMException && caught.name === 'AbortError' && !timedOut)
      ) {
        throw caught;
      }

      if (attempt >= retries) {
        throw caught;
      }

      const retryNumber = attempt + 1;
      onRetry?.(retryNumber);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 2_000 * 2 ** (attempt));
      });
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abortFromExternal);
    }
  }

  throw new Error('Fetch retry loop exhausted.');
}
