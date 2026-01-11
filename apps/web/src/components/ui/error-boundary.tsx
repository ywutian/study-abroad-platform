'use client';

import React, { Component, ErrorInfo, ReactNode, useState, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// 类型定义
// ============================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 错误边界级别 */
  level?: 'page' | 'section' | 'component';
  /** 是否显示错误详情 */
  showDetails?: boolean;
  /** 自定义错误消息 */
  message?: string;
  /** 最大重试次数 */
  maxRetries?: number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId: string | null;
  retryCount: number;
}

// ============================================
// 全局错误边界
// ============================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static defaultProps: Partial<ErrorBoundaryProps> = {
    level: 'section',
    showDetails: process.env.NODE_ENV === 'development',
    maxRetries: 3,
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
    this.setState({ errorInfo });
    
    // Send to Sentry in production
    if (process.env.NODE_ENV === 'production') {
      const eventId = Sentry.captureException(error, {
        extra: {
          componentStack: errorInfo.componentStack,
          level: this.props.level,
        },
        tags: {
          errorBoundaryLevel: this.props.level,
        },
      });
      this.setState({ eventId });
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;
    
    if (retryCount < maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1,
      });
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReportFeedback = () => {
    const { eventId } = this.state;
    if (eventId && typeof Sentry.showReportDialog === 'function') {
      Sentry.showReportDialog({ eventId });
    }
  };

  render() {
    const { hasError, error, errorInfo, eventId, retryCount } = this.state;
    const { children, fallback, level, showDetails, message, maxRetries = 3 } = this.props;

    if (!hasError) {
      return children;
    }

    if (fallback) {
      return fallback;
    }

    const canRetry = retryCount < maxRetries;

    // 根据级别使用不同样式
    const containerClass = cn(
      'flex flex-col items-center justify-center',
      level === 'page' && 'min-h-screen',
      level === 'section' && 'min-h-[400px] p-8',
      level === 'component' && 'min-h-[200px] p-4'
    );

    return (
      <motion.div
        className={containerClass}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mx-auto max-w-md text-center">
          <motion.div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
          >
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </motion.div>
          
          <h2 className="mb-2 text-2xl font-bold">
            {level === 'page' ? 'Page Error' : 'Something went wrong'}
          </h2>
          <p className="mb-6 text-muted-foreground">
            {message || 'Something went wrong. Please try refreshing or go back to the homepage.'}
          </p>

          {/* Retry count hint */}
          {retryCount > 0 && (
            <p className="mb-4 text-sm text-warning">
              Retried {retryCount}/{maxRetries} times
            </p>
          )}

          {/* Error details (dev mode or explicitly enabled) */}
          {showDetails && error && (
            <details className="mb-6 rounded-lg border bg-muted/50 p-4 text-left group">
              <summary className="cursor-pointer text-sm font-medium flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Error Details
                <ChevronDown className="h-4 w-4 ml-auto transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-4 space-y-2">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Error Message:</span>
                  <pre className="mt-1 overflow-auto rounded bg-background p-2 text-xs">
                    {error.message}
                  </pre>
                </div>
                {error.stack && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Stack:</span>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2 text-xs">
                      {error.stack}
                    </pre>
                  </div>
                )}
                {errorInfo?.componentStack && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Component Stack:</span>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2 text-xs">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            {canRetry && (
              <Button onClick={this.handleRetry} variant="default">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry {retryCount > 0 && `(${maxRetries - retryCount})`}
              </Button>
            )}
            <Button onClick={this.handleGoHome} variant="outline">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
            {eventId && process.env.NODE_ENV === 'production' && (
              <Button onClick={this.handleReportFeedback} variant="ghost" size="sm">
                <Send className="mr-2 h-4 w-4" />
                Report Issue
              </Button>
            )}
          </div>

          {/* Error ID (production) */}
          {eventId && (
            <p className="mt-4 text-xs text-muted-foreground">
              Error ID: {eventId.slice(0, 8)}
            </p>
          )}
        </div>
      </motion.div>
    );
  }
}

// ============================================
// 页面级错误边界
// ============================================

export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      level="page"
      message="Page failed to load. Please try again or go back to the homepage."
    >
      {children}
    </ErrorBoundary>
  );
}

// ============================================
// 组件级错误边界
// ============================================

export function ComponentErrorBoundary({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary
      level="component"
      fallback={fallback}
      showDetails={false}
      maxRetries={2}
    >
      {children}
    </ErrorBoundary>
  );
}

// ============================================
// Hooks
// ============================================

/**
 * 错误处理 Hook
 */
export function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return setError;
}

/**
 * 异步错误处理 Hook
 */
export function useAsyncError() {
  const [, setError] = useState();
  
  return useCallback(
    (error: Error) => {
      setError(() => {
        throw error;
      });
    },
    []
  );
}

/**
 * 安全执行函数 Hook
 */
export function useSafeHandler<T extends (...args: unknown[]) => unknown>(
  handler: T,
  onError?: (error: Error) => void
): T {
  return useCallback(
    ((...args: unknown[]) => {
      try {
        const result = handler(...args);
        if (result instanceof Promise) {
          return result.catch((error: Error) => {
            console.error('Async handler error:', error);
            onError?.(error);
          });
        }
        return result;
      } catch (error) {
        console.error('Handler error:', error);
        onError?.(error as Error);
      }
    }) as T,
    [handler, onError]
  );
}

