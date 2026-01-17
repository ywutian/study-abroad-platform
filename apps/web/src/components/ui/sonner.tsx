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
  Sparkles,
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
            'group toast group-[.toaster]:bg-card/95 group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-2xl group-[.toaster]:rounded-2xl group-[.toaster]:backdrop-blur-xl group-[.toaster]:animate-toast-slide-in',
          description: 'group-[.toast]:text-muted-foreground group-[.toast]:text-sm',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:font-medium group-[.toast]:transition-all group-[.toast]:hover:scale-105',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg',
          closeButton:
            'group-[.toast]:bg-transparent group-[.toast]:border-none group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground group-[.toast]:transition-colors',
          success:
            'group-[.toaster]:border-success/40 group-[.toaster]:bg-success/8 [&>div>svg]:text-success group-[.toaster]:shadow-success/10',
          error:
            'group-[.toaster]:border-destructive/40 group-[.toaster]:bg-destructive/8 [&>div>svg]:text-destructive group-[.toaster]:shadow-destructive/10',
          warning:
            'group-[.toaster]:border-warning/40 group-[.toaster]:bg-warning/8 [&>div>svg]:text-warning group-[.toaster]:shadow-warning/10',
          info: 'group-[.toaster]:border-primary/40 group-[.toaster]:bg-primary/8 [&>div>svg]:text-primary group-[.toaster]:shadow-primary/10',
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
          '--border-radius': '1rem',
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
    icon: <Sparkles className="size-5 text-primary animate-scale-in" />,
    className: 'border-primary/30 bg-primary/5',
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
    className: 'border-success/40 bg-success/8 shadow-lg shadow-success/10',
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
