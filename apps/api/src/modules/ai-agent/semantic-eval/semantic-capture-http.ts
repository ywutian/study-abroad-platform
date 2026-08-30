import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

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

/**
 * Node's fetch does not deliver a DELETE body to this API: the server's
 * validator reports the field as missing, while curl and `node:https` sending
 * the identical request are accepted. POST bodies are unaffected. Account
 * retirement posts its password in a DELETE body, so under fetch that call
 * fails and the synthetic account is never soft-deleted — silently, because
 * the caller only kept `.ok`.
 *
 * This is a fetch-shaped shim over `node:https` for exactly that case. It
 * implements only what `fetchSemanticCapture` and its callers read.
 */
export function httpsFetchImpl(
  url: string | URL | Request,
  init: RequestInit = {},
): Promise<Response> {
  const target = new URL(String(url));
  const body =
    typeof init.body === 'string' ? Buffer.from(init.body) : undefined;
  if (init.body !== undefined && body === undefined) {
    return Promise.reject(new Error('SEMANTIC_REQUEST_BODY_UNSUPPORTED'));
  }
  return new Promise((resolve, reject) => {
    const send = target.protocol === 'http:' ? httpRequest : httpsRequest;
    const request = send(
      {
        protocol: target.protocol,
        host: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        method: init.method ?? 'GET',
        headers: {
          ...(body ? { 'content-length': body.byteLength } : {}),
          ...((init.headers as Record<string, string>) ?? {}),
        },
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          text += chunk;
        });
        response.on('end', () => {
          const status = response.statusCode ?? 0;
          const headers = new Headers();
          for (const [name, value] of Object.entries(response.headers)) {
            if (typeof value === 'string') headers.set(name, value);
            else if (Array.isArray(value))
              for (const item of value) headers.append(name, item);
          }
          // A real Response rather than a cast shape: the callers read ok,
          // status, headers.get and text, and all four come for free.
          resolve(
            new Response(status === 204 || status === 304 ? null : text, {
              status,
              headers,
            }),
          );
        });
      },
    );
    request.on('error', reject);
    init.signal?.addEventListener('abort', () => request.destroy());
    if (body) request.write(body);
    request.end();
  });
}
