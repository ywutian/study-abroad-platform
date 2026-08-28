/** Capture-only HTTP boundary. Does not change the production Provider. */
export async function fetchSemanticCapture(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ response: Response; text: string }> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('SEMANTIC_REQUEST_TIMEOUT_INVALID');
  }
  const controller = new AbortController();
  const startedAt = Date.now();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new Error('SEMANTIC_REQUEST_TIMEOUT'));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(url, {
          ...init,
          redirect: 'error',
          signal: controller.signal,
        });
        const text = await response.text();
        // A suspended laptop can resume I/O before the timer callback runs.
        if (Date.now() - startedAt >= timeoutMs) {
          timedOut = true;
          controller.abort();
          throw new Error('SEMANTIC_REQUEST_TIMEOUT');
        }
        return { response, text };
      })(),
      deadline,
    ]);
  } catch {
    throw new Error(
      timedOut ? 'SEMANTIC_REQUEST_TIMEOUT' : 'SEMANTIC_REQUEST_FAILED',
    );
  } finally {
    clearTimeout(timer);
  }
}
