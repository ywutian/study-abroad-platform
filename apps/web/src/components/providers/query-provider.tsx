'use client';

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/api-error';

// 扩展 React Query 类型，支持 meta.skipGlobalErrorToast
declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Set to true to prevent the global MutationCache from showing a toast */
      skipGlobalErrorToast?: boolean;
    };
  }
}

/**
 * 从错误对象中提取用户友好的错误消息（优先使用翻译后的 displayMessage）
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.displayMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Operation failed, please try again';
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            // 仅对已有数据的查询显示错误（避免初始加载时显示错误）
            if (query.state.data !== undefined) {
              toast.error(getErrorMessage(error));
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            // 组件通过 meta.skipGlobalErrorToast 跳过全局 toast
            if (mutation.options.meta?.skipGlobalErrorToast) return;
            // 403/500 已在 client.ts 弹过 toast，不重复
            if (error instanceof ApiError && (error.statusCode === 403 || error.statusCode >= 500))
              return;
            toast.error(getErrorMessage(error));
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
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
