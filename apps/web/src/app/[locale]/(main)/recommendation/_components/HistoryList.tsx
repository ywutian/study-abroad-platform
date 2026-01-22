'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StaggerContainer, StaggerItem } from '@/components/ui/motion';
import { DeleteConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useRecommendationHistory, useDeleteRecommendation } from '@/hooks/use-recommendation';
import type { RecommendationResult } from '@study-abroad/shared';
import { useState } from 'react';

interface HistoryListProps {
  enabled: boolean;
  onViewResult: (item: RecommendationResult) => void;
  onSwitchToGenerate: () => void;
}

export function HistoryList({ enabled, onViewResult, onSwitchToGenerate }: HistoryListProps) {
  const t = useTranslations('recommendation');
  const format = useFormatter();
  const { data: history, isLoading } = useRecommendationHistory(enabled);
  const deleteMutation = useDeleteRecommendation();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast.success(t('deleteSuccess'));
    } catch (error: any) {
      toast.error(error.message);
    }
    setDeleteId(null);
  };

  if (isLoading) {
    return <LoadingState loading variant="card" count={3} />;
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            type="first-time"
            title={t('noHistory')}
            description={t('noHistoryDesc')}
            action={{
              label: t('generateFirst'),
              onClick: onSwitchToGenerate,
              icon: <Sparkles className="h-4 w-4" />,
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <StaggerContainer className="space-y-4">
        {history.map((item) => (
          <StaggerItem key={item.id}>
            <Card className="card-elevated cursor-pointer" onClick={() => onViewResult(item)}>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-red-600 border-red-200">
                      {t('reach')}: {item.recommendations.filter((r) => r.tier === 'reach').length}
                    </Badge>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-200">
                      {t('match')}: {item.recommendations.filter((r) => r.tier === 'match').length}
                    </Badge>
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      {t('safety')}:{' '}
                      {item.recommendations.filter((r) => r.tier === 'safety').length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {format.dateTime(new Date(item.createdAt), {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDelete(e, item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{item.summary}</p>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}

        {history.length >= 10 && (
          <p className="text-xs text-center text-muted-foreground">
            {t('showingRecent', { count: 10 })}
          </p>
        )}
      </StaggerContainer>

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
