import { Header, PageTransitionWrapper, MobileTabBar } from '@/components/layout';
import { FloatingChat } from '@/components/features/agent-chat';
import { ErrorBoundary } from '@/components/ui/error-boundary';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <Header />
      <PageTransitionWrapper className="flex-1">
        <main className="py-6 sm:py-8 pb-20 md:pb-8 overflow-x-hidden">
          <ErrorBoundary level="page">{children}</ErrorBoundary>
        </main>
      </PageTransitionWrapper>
      <FloatingChat />
      <MobileTabBar />
    </div>
  );
}
