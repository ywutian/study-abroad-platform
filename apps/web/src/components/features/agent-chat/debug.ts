'use client';

interface AgentChatDebugEvent {
  event: string;
  at: string;
  data?: Record<string, unknown>;
}

const DEBUG_KEY = '__agentChatDebug';
const MAX_DEBUG_EVENTS = 200;

function getDebugStore() {
  if (typeof window === 'undefined') return null;
  const debugWindow = window as Window & {
    __agentChatDebug?: AgentChatDebugEvent[];
  };
  if (!Array.isArray(debugWindow.__agentChatDebug)) {
    debugWindow.__agentChatDebug = [];
  }
  return debugWindow.__agentChatDebug;
}

export function resetAgentChatDebug() {
  const store = getDebugStore();
  if (!store) return;
  store.length = 0;
  try {
    window.sessionStorage.removeItem(DEBUG_KEY);
  } catch {
    // Ignore storage failures in private browsing.
  }
}

export function pushAgentChatDebug(event: string, data?: Record<string, unknown>) {
  const store = getDebugStore();
  if (!store) return;
  store.push({
    event,
    at: new Date().toISOString(),
    ...(data ? { data } : {}),
  });
  if (store.length > MAX_DEBUG_EVENTS) {
    store.splice(0, store.length - MAX_DEBUG_EVENTS);
  }
  try {
    window.sessionStorage.setItem(DEBUG_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage failures in private browsing.
  }
}
