'use client';

import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';

/**
 * 顶部进度条 Provider
 *
 * 优化配置：
 * - trickleSpeed: 100ms，更快的视觉反馈
 * - minimum: 0.15，起始位置更明显，让用户立即感知到页面在加载
 * - speed: 200ms，动画过渡更流畅
 */
export function ProgressProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ProgressBar
        height="3px"
        color="var(--ds-primary)"
        options={{
          showSpinner: false,
          trickleSpeed: 100,
          minimum: 0.15,
          speed: 200,
        }}
        shallowRouting
      />
      {/* 进度条光晕效果 */}
      <style jsx global>{`
        #nprogress .bar {
          background: linear-gradient(
            90deg,
            var(--ds-primary),
            color-mix(in oklab, var(--ds-primary) 72%, var(--ds-info) 28%),
            var(--ds-primary)
          ) !important;
          box-shadow:
            0 0 8px color-mix(in oklab, var(--ds-primary) 60%, transparent),
            0 0 16px color-mix(in oklab, var(--ds-primary) 25%, transparent) !important;
          border-radius: var(--theme-radius-badge);
        }
        #nprogress .peg {
          box-shadow:
            0 0 10px color-mix(in oklab, var(--ds-primary) 80%, transparent),
            0 0 24px color-mix(in oklab, var(--ds-primary) 40%, transparent) !important;
        }
      `}</style>
    </>
  );
}
