'use client';

/**
 * Toast 通知组件 - 精美动画与视觉效果
 */

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  Lightbulb,
  PartyPopper,
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
            'group toast group-[.toaster]:rounded-[var(--theme-radius-card)] group-[.toaster]:border-border group-[.toaster]:bg-[color:var(--theme-popover-bg)] group-[.toaster]:text-foreground group-[.toaster]:shadow-[var(--theme-card-hover-shadow)] group-[.toaster]:backdrop-blur-[var(--theme-backdrop-blur)] group-[.toaster]:animate-toast-slide-in',
          description: 'group-[.toast]:text-muted-foreground group-[.toast]:text-sm',
          actionButton:
            'group-[.toast]:bg-[color:var(--theme-button-primary-bg)] group-[.toast]:text-[color:var(--theme-button-primary-fg)] group-[.toast]:rounded-[var(--theme-radius-button)] group-[.toast]:font-medium group-[.toast]:transition-all group-[.toast]:hover:opacity-95',
          cancelButton:
            'group-[.toast]:bg-[color:var(--theme-button-tertiary-bg)] group-[.toast]:text-[color:var(--theme-button-tertiary-fg)] group-[.toast]:rounded-[var(--theme-radius-button)] group-[.toast]:border group-[.toast]:border-border',
          closeButton:
            '!h-10 !w-10 !min-h-10 !min-w-10 sm:!h-8 sm:!w-8 sm:!min-h-8 sm:!min-w-8 group-[.toast]:bg-transparent group-[.toast]:border-none group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground group-[.toast]:transition-colors',
          success: 'group-[.toaster]:border-success/35 [&>div>svg]:text-success',
          error: 'group-[.toaster]:border-destructive/35 [&>div>svg]:text-destructive',
          warning: 'group-[.toaster]:border-warning/35 [&>div>svg]:text-warning',
          info: 'group-[.toaster]:border-primary/35 [&>div>svg]:text-primary',
        },
        duration: 3500,
      }}
      icons={{
        success: <CircleCheckIcon className="size-5 animate-scale-in" />,
        info: <InfoIcon className="size-5 animate-scale-in" />,
        warning: <TriangleAlertIcon className="size-5 animate-scale-in" />,
        error: <OctagonXIcon className="size-5 animate-scale-in" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      closeButton
      richColors
      expand
      gap={10}
      style={
        {
          '--normal-bg': 'var(--card)',
          '--normal-text': 'var(--card-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--theme-radius-card)',
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
    icon: <Lightbulb className="size-5 text-primary animate-scale-in" />,
    className: 'border-primary/30 bg-[color:var(--theme-control-selected-bg)]',
    duration: 5000,
  });
}

/**
 * 登录成功提示 - 特殊欢迎样式
 */
export function toastLoginSuccess(message: string, description?: string) {
  return sonnerToast(message, {
    description,
    icon: <PartyPopper className="size-5 text-success animate-scale-in" />,
    className: 'border-success/40 bg-success/10 shadow-[var(--theme-card-shadow)]',
    duration: 2500,
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
