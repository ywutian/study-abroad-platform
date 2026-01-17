'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UseUnsavedChangesOptions {
  message?: string;
  enabled?: boolean;
}

/**
 * Hook 用于检测和提示未保存的更改
 */
export function useUnsavedChanges(hasChanges: boolean, options: UseUnsavedChangesOptions = {}) {
  const { message = '您有未保存的更改，确定要离开吗？', enabled = true } = options;
  const router = useRouter();
  const [isBlocking, setIsBlocking] = useState(false);

  // 处理浏览器刷新/关闭
  useEffect(() => {
    if (!enabled || !hasChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges, message, enabled]);

  // 处理路由变化
  useEffect(() => {
    if (!enabled || !hasChanges) {
      setIsBlocking(false);
      return;
    }

    setIsBlocking(true);

    // Next.js 13+ 路由拦截
    const handleRouteChange = () => {
      if (hasChanges && enabled) {
        const confirmLeave = window.confirm(message);
        if (!confirmLeave) {
          // 取消导航
          throw new Error('Navigation cancelled');
        }
      }
    };

    // 监听 popstate（浏览器后退/前进按钮）
    const handlePopState = (e: PopStateEvent) => {
      if (hasChanges && enabled) {
        const confirmLeave = window.confirm(message);
        if (!confirmLeave) {
          // 阻止默认行为并恢复状态
          window.history.pushState(null, '', window.location.href);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasChanges, message, enabled, router]);

  // 确认离开
  const confirmLeave = useCallback(
    (callback: () => void) => {
      if (!hasChanges || !enabled) {
        callback();
        return;
      }

      const confirmed = window.confirm(message);
      if (confirmed) {
        callback();
      }
    },
    [hasChanges, message, enabled]
  );

  // 安全导航
  const safeNavigate = useCallback(
    (path: string) => {
      confirmLeave(() => router.push(path));
    },
    [confirmLeave, router]
  );

  return {
    isBlocking,
    confirmLeave,
    safeNavigate,
  };
}

// 表单变更跟踪 Hook
export function useFormChanges<T extends Record<string, unknown>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const [initialSnapshot, setInitialSnapshot] = useState<T>(initialValues);

  // 检查是否有变更
  const hasChanges = JSON.stringify(values) !== JSON.stringify(initialSnapshot);

  // 更新值
  const updateValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  // 批量更新
  const updateValues = useCallback((updates: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...updates }));
  }, []);

  // 重置为初始值
  const resetValues = useCallback(() => {
    setValues(initialSnapshot);
  }, [initialSnapshot]);

  // 保存后更新初始快照
  const markAsSaved = useCallback(() => {
    setInitialSnapshot(values);
  }, [values]);

  // 设置新的初始值
  const setInitialValues = useCallback((newValues: T) => {
    setValues(newValues);
    setInitialSnapshot(newValues);
  }, []);

  return {
    values,
    hasChanges,
    updateValue,
    updateValues,
    resetValues,
    markAsSaved,
    setInitialValues,
  };
}
