type QuerySessionResetHandler = () => void | Promise<void>;

let resetHandler: QuerySessionResetHandler | null = null;

/** Registers the active QueryClient/persister cleanup without coupling auth to React. */
export function registerQuerySessionReset(handler: QuerySessionResetHandler): () => void {
  resetHandler = handler;
  return () => {
    if (resetHandler === handler) resetHandler = null;
  };
}

/** Clears all in-memory and persisted query data at an authentication boundary. */
export async function resetQuerySession(): Promise<void> {
  await resetHandler?.();
}
