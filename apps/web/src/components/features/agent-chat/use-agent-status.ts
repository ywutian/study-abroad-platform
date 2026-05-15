'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '@/lib/api';

export interface AgentHealthSnapshot {
  status?: 'healthy' | 'degraded' | string;
  llm?: {
    isHealthy?: boolean;
    provider?: string;
    model?: string;
    latencyMs?: number;
    error?: string;
  };
  timestamp?: string;
}

export interface AgentUsageSnapshot {
  today?: {
    tokens?: number;
    cost?: number;
    calls?: number;
  };
  thisMonth?: {
    tokens?: number;
    cost?: number;
    calls?: number;
  };
  quota?: {
    dailyTokens?: number;
    monthlyTokens?: number;
    dailyCost?: number;
    monthlyCost?: number;
  };
  remaining?: {
    dailyTokens?: number;
    monthlyTokens?: number;
    dailyCost?: number;
    monthlyCost?: number;
  };
}

export interface AgentRateLimitBucket {
  remaining?: number;
  limit?: number;
  maxRequests?: number;
  resetAt?: string;
  resetTime?: number;
  isLimited?: boolean;
}

export interface AgentRateLimitSnapshot {
  user?: AgentRateLimitBucket;
  conversation?: AgentRateLimitBucket;
}

const agentStatusKeys = {
  all: ['agent-chat', 'status'] as const,
  health: () => [...agentStatusKeys.all, 'health'] as const,
  usage: () => [...agentStatusKeys.all, 'usage'] as const,
  rateLimit: () => [...agentStatusKeys.all, 'rate-limit'] as const,
};

const quietConfig = {
  suppressErrorToast: true,
  retries: 0,
  timeout: 10_000,
} as const;

export function useAgentStatus() {
  const queryClient = useQueryClient();

  const health = useQuery({
    queryKey: agentStatusKeys.health(),
    queryFn: () => apiClient.get<AgentHealthSnapshot>(`${API_ROUTES.AI_AGENT}/health`, quietConfig),
    staleTime: 30_000,
    retry: 1,
  });

  const usage = useQuery({
    queryKey: agentStatusKeys.usage(),
    queryFn: () => apiClient.get<AgentUsageSnapshot>(`${API_ROUTES.AI_AGENT}/usage`, quietConfig),
    staleTime: 30_000,
    retry: 1,
  });

  const rateLimit = useQuery({
    queryKey: agentStatusKeys.rateLimit(),
    queryFn: () =>
      apiClient.get<AgentRateLimitSnapshot>(`${API_ROUTES.AI_AGENT}/rate-limit`, quietConfig),
    staleTime: 15_000,
    retry: 1,
  });

  const refreshContext = useMutation({
    mutationFn: () =>
      apiClient.post<{ success: boolean }>(
        `${API_ROUTES.AI_AGENT}/refresh-context`,
        undefined,
        quietConfig
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentStatusKeys.all });
    },
  });

  return {
    health,
    usage,
    rateLimit,
    refreshContext,
  };
}
