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
        color="oklch(0.58 0.22 255)"
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
            oklch(0.58 0.22 255),
            oklch(0.65 0.2 240),
            oklch(0.58 0.22 255)
          ) !important;
          box-shadow:
            0 0 8px oklch(0.58 0.22 255 / 60%),
            0 0 16px oklch(0.58 0.22 255 / 25%) !important;
          border-radius: 0 2px 2px 0;
        }
        #nprogress .peg {
          box-shadow:
            0 0 10px oklch(0.58 0.22 255 / 80%),
            0 0 24px oklch(0.58 0.22 255 / 40%) !important;
        }
      `}</style>
    </>
  );
}
