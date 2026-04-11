'use client';

import { create } from 'zustand';
import type { AgentActionPayload } from './types';

interface FloatingChatBridgeState {
  queue: AgentActionPayload[];
  enqueue: (action: AgentActionPayload) => void;
  consumeFirst: () => void;
}

export const useFloatingChatBridgeStore = create<FloatingChatBridgeState>((set) => ({
  queue: [],
  enqueue: (action) =>
    set((state) => ({
      queue: [...state.queue, { ...action, message: action.message.trim() }],
    })),
  consumeFirst: () =>
    set((state) => ({
      queue: state.queue.slice(1),
    })),
}));

export function openFloatingAgentChat(action: AgentActionPayload) {
  if (!action.message.trim()) return;
  useFloatingChatBridgeStore.getState().enqueue(action);
}
