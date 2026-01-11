'use client';

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

/**
 * 从错误对象中提取用户友好的错误消息
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // API 错误通常有 message 属性
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '操作失败，请重试';
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            // 仅对已有数据的查询显示错误（避免初始加载时显示错误）
            if (query.state.data !== undefined) {
              toast.error(`数据更新失败: ${getErrorMessage(error)}`);
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            toast.error(getErrorMessage(error));
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
          mutations: {
            // 单个 mutation 可以通过 onError 覆盖全局行为
            retry: 0,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

