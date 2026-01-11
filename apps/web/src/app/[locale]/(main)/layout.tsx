import { Header, PageTransitionWrapper, MobileTabBar } from '@/components/layout';
import { FloatingChat } from '@/components/features/agent-chat';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page-gradient">
      <Header />
      <PageTransitionWrapper>
        {/* 为底部 Tab Bar 留出空间 */}
        <main className="py-6 sm:py-8 pb-20 md:pb-8">{children}</main>
      </PageTransitionWrapper>
      <FloatingChat />
      <MobileTabBar />
    </div>
  );
}
