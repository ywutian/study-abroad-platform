'use client';

/**
 * Toast 通知组件 - 自定义样式
 */

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
  Sparkles,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps, toast as sonnerToast } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      position="top-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl group-[.toaster]:backdrop-blur-sm',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:font-medium',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg',
          closeButton:
            'group-[.toast]:bg-transparent group-[.toast]:border-none group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground',
          success:
            'group-[.toaster]:border-success/30 group-[.toaster]:bg-success/5 [&>div>svg]:text-success',
          error:
            'group-[.toaster]:border-destructive/30 group-[.toaster]:bg-destructive/5 [&>div>svg]:text-destructive',
          warning:
            'group-[.toaster]:border-warning/30 group-[.toaster]:bg-warning/5 [&>div>svg]:text-warning',
          info: 'group-[.toaster]:border-primary/30 group-[.toaster]:bg-primary/5 [&>div>svg]:text-primary',
        },
        duration: 4000,
      }}
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      closeButton
      richColors
      expand
      style={
        {
          '--normal-bg': 'hsl(var(--card))',
          '--normal-text': 'hsl(var(--card-foreground))',
          '--normal-border': 'hsl(var(--border))',
          '--border-radius': 'var(--radius)',
          '--success-bg': 'hsl(var(--success) / 0.1)',
          '--success-text': 'hsl(var(--success))',
          '--success-border': 'hsl(var(--success) / 0.3)',
          '--error-bg': 'hsl(var(--destructive) / 0.1)',
          '--error-text': 'hsl(var(--destructive))',
          '--error-border': 'hsl(var(--destructive) / 0.3)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

// ============================================
// 自定义 Toast 工具函数
// ============================================

interface CustomToastOptions {
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

/**
 * 成功提示 - 带动画图标
 */
export function toastSuccess(message: string, options?: CustomToastOptions) {
  return sonnerToast.success(message, {
    description: options?.description,
    action: options?.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
    duration: options?.duration,
  });
}

/**
 * 错误提示
 */
export function toastError(message: string, options?: CustomToastOptions) {
  return sonnerToast.error(message, {
    description: options?.description,
    action: options?.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
    duration: options?.duration || 5000,
  });
}

/**
 * 警告提示
 */
export function toastWarning(message: string, options?: CustomToastOptions) {
  return sonnerToast.warning(message, {
    description: options?.description,
    action: options?.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
    duration: options?.duration,
  });
}

/**
 * 信息提示
 */
export function toastInfo(message: string, options?: CustomToastOptions) {
  return sonnerToast.info(message, {
    description: options?.description,
    action: options?.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
    duration: options?.duration,
  });
}

/**
 * 加载提示 - 返回 promise 以便更新状态
 */
export function toastLoading(message: string) {
  return sonnerToast.loading(message);
}

/**
 * Promise 提示 - 自动处理加载/成功/失败状态
 */
export function toastPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: Error) => string);
  }
) {
  return sonnerToast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
  });
}

/**
 * 自定义 Toast - 用于特殊场景
 */
export function toastCustom(
  title: string,
  options?: CustomToastOptions & {
    icon?: React.ReactNode;
  }
) {
  return sonnerToast(title, {
    description: options?.description,
    icon: options?.icon,
    action: options?.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
    duration: options?.duration,
  });
}

/**
 * AI 完成提示 - 特殊样式
 */
export function toastAIComplete(message: string, description?: string) {
  return sonnerToast(message, {
    description,
    icon: <Sparkles className="size-5 text-primary" />,
    className: 'border-primary/30 bg-primary/5',
    duration: 5000,
  });
}

/**
 * 关闭所有 Toast
 */
export function dismissAllToasts() {
  sonnerToast.dismiss();
}

/**
 * 关闭指定 Toast
 */
export function dismissToast(toastId: string | number) {
  sonnerToast.dismiss(toastId);
}

export { Toaster };
