'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/lib/i18n/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/layout';
import { ClipboardCheck, Plus, FileText, BookOpen } from 'lucide-react';
import { ReviewStatsCards } from './_components/review-stats-cards';
import { ReviewQueueTab } from './_components/review-queue-tab';
import { PendingCasesTab } from './_components/pending-cases-tab';
import { ImportHistoryTab } from './_components/import-history-tab';
import { BulkImportTab } from './_components/bulk-import-tab';
import { CreateCaseDialog } from './_components/create-case-dialog';
import { CreateEssayPromptDialog } from './_components/create-essay-prompt-dialog';

const DataCollectionTab = dynamic(
  () => import('./_components/data-collection-tab').then((m) => m.DataCollectionTab),
  { ssr: false }
);

const BatchEntryTab = dynamic(
  () => import('./_components/batch-entry-tab').then((m) => m.BatchEntryTab),
  { ssr: false }
);

const VALID_TABS = ['queue', 'cases', 'history', 'import', 'batch', 'pipeline'] as const;
type DataReviewTab = (typeof VALID_TABS)[number];

export default function AdminDataReviewPage() {
  const t = useTranslations('admin.dataReview');
  const mt = useTranslations('admin.dataReview.manualEntry');
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = VALID_TABS.includes(searchParams.get('tab') as DataReviewTab)
    ? (searchParams.get('tab') as DataReviewTab)
    : 'queue';
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [essayDialogOpen, setEssayDialogOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'queue') params.delete('tab');
    else params.set('tab', tab);
    const qs = params.toString();
    router.replace(`/admin/data-review${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={ClipboardCheck}
        color="amber"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                {mt('addData')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCaseDialogOpen(true)}>
                <FileText className="mr-2 h-4 w-4" />
                {mt('addCase')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEssayDialogOpen(true)}>
                <BookOpen className="mr-2 h-4 w-4" />
                {mt('addEssayPrompt')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <ReviewStatsCards />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="queue">{t('tabs.queue')}</TabsTrigger>
          <TabsTrigger value="cases">{t('tabs.cases')}</TabsTrigger>
          <TabsTrigger value="history">{t('tabs.history')}</TabsTrigger>
          <TabsTrigger value="import">{t('tabs.import')}</TabsTrigger>
          <TabsTrigger value="batch">{t('tabs.batch')}</TabsTrigger>
          <TabsTrigger value="pipeline">{t('tabs.pipeline')}</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <ReviewQueueTab />
        </TabsContent>
        <TabsContent value="cases">
          <PendingCasesTab />
        </TabsContent>
        <TabsContent value="history">
          <ImportHistoryTab />
        </TabsContent>
        <TabsContent value="import">
          <BulkImportTab />
        </TabsContent>
        <TabsContent value="batch">
          <BatchEntryTab />
        </TabsContent>
        <TabsContent value="pipeline">
          <DataCollectionTab onSwitchTab={handleTabChange} />
        </TabsContent>
      </Tabs>

      <CreateCaseDialog open={caseDialogOpen} onOpenChange={setCaseDialogOpen} />
      <CreateEssayPromptDialog open={essayDialogOpen} onOpenChange={setEssayDialogOpen} />
    </div>
  );
}
