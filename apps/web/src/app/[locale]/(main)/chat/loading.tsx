import { PageContainer } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';

export default function ChatLoading() {
  return (
    <PageContainer>
      <div className="flex h-[calc(100vh-8rem)] gap-4">
        {/* Conversation list sidebar */}
        <div className="hidden w-80 shrink-0 space-y-3 rounded-xl border bg-card p-4 md:block">
          <Skeleton className="h-10 w-full rounded-md" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg p-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>

        {/* Message area */}
        <div className="flex flex-1 flex-col rounded-xl border bg-card">
          {/* Chat header */}
          <div className="flex items-center gap-3 border-b p-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <Skeleton className={`h-12 rounded-xl ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} />
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t p-4">
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
