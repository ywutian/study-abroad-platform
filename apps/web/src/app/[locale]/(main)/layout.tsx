import { Header, PageTransitionWrapper } from '@/components/layout';
import { FloatingChat } from '@/components/features/agent-chat';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page-gradient">
      <Header />
      <PageTransitionWrapper>
        <main className="py-6 sm:py-8">{children}</main>
      </PageTransitionWrapper>
      <FloatingChat />
    </div>
  );
}
