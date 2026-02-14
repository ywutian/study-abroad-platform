import { redirect } from 'next/navigation';

/**
 * /swipe 路由已废弃，统一重定向到 /hall（案例预测标签页）。
 *
 * 背景: SwipeController 已从 SwipeModule 移除 (见 ADR-0009)，
 * 所有滑动预测功能统一通过 HallController /hall/swipe/* 端点提供。
 */
export default async function SwipePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/hall`);
}
