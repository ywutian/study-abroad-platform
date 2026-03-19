'use client';

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type AIFeature =
  | 'essay-review'
  | 'essay-polish'
  | 'essay-brainstorm'
  | 'profile-analysis'
  | 'prediction'
  | 'recommendation'
  | 'agent-chat'
  | 'uncommon-app';

interface AIErrorBoundaryProps {
  feature: AIFeature;
  children: ReactNode;
  fallback?: ReactNode;
}

interface AIErrorBoundaryState {
  hasError: boolean;
  retryCount: number;
}

const MAX_RETRIES = 3;

const FEATURE_LABELS: Record<AIFeature, { zh: string; en: string }> = {
  'essay-review': { zh: '文书评审', en: 'Essay Review' },
  'essay-polish': { zh: '文书润色', en: 'Essay Polish' },
  'essay-brainstorm': { zh: '文书灵感', en: 'Essay Brainstorm' },
  'profile-analysis': { zh: '档案分析', en: 'Profile Analysis' },
  prediction: { zh: '录取预测', en: 'Admission Prediction' },
  'uncommon-app': { zh: '申请规划', en: 'Application Planning' },
  recommendation: { zh: '智能选校', en: 'School Recommendation' },
  'agent-chat': { zh: 'AI 助手', en: 'AI Assistant' },
};

/**
 * Error boundary for AI feature components.
 *
 * Usage:
 * ```tsx
 * <AIErrorBoundary feature="essay-review">
 *   <EssayReviewPanel essayId={id} />
 * </AIErrorBoundary>
 * ```
 */
export class AIErrorBoundary extends Component<AIErrorBoundaryProps, AIErrorBoundaryState> {
  state: AIErrorBoundaryState = { hasError: false, retryCount: 0 };

  static getDerivedStateFromError(): Partial<AIErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[AIErrorBoundary:${this.props.feature}]`,
      error.message,
      errorInfo.componentStack
    );
  }

  handleRetry = () => {
    if (this.state.retryCount < MAX_RETRIES) {
      this.setState((prev) => ({
        hasError: false,
        retryCount: prev.retryCount + 1,
      }));
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const locale =
      typeof window !== 'undefined' && window.location.pathname.startsWith('/zh') ? 'zh' : 'en';
    const label = FEATURE_LABELS[this.props.feature][locale];
    const canRetry = this.state.retryCount < MAX_RETRIES;

    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <div className="space-y-1">
            <p className="font-medium">
              {locale === 'zh' ? `${label}功能出现异常` : `${label} encountered an error`}
            </p>
            <p className="text-sm text-muted-foreground">
              {locale === 'zh'
                ? '请稍后重试，如持续出现请联系支持'
                : 'Please try again. Contact support if the issue persists.'}
            </p>
          </div>
          {canRetry && (
            <Button variant="outline" size="sm" onClick={this.handleRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {locale === 'zh' ? '重试' : 'Retry'}
              {this.state.retryCount > 0 && ` (${this.state.retryCount}/${MAX_RETRIES})`}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
}
