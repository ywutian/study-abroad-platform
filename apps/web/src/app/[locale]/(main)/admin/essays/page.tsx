'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout';
import {
  EssayPromptManager,
  EssayCaseReviewManager,
  BulkImportDialog,
  EssayPipelineDashboard,
  AdminGalleryAiMetrics,
} from '@/components/features';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PenTool, Upload, FileText, BookOpen, Workflow, BarChart3 } from 'lucide-react';

export default function AdminEssaysPage() {
  const t = useTranslations('admin');
  const tEssay = useTranslations('essayAdmin');

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importType, setImportType] = useState<'essay-prompts' | 'cases'>('essay-prompts');

  const openImport = (type: 'essay-prompts' | 'cases') => {
    setImportType(type);
    setImportDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title={t('sidebar.essays')}
        description={t('overview.essayDesc')}
        icon={PenTool}
        color="rose"
      />
      <div className="mt-6">
        <Tabs defaultValue="prompts">
          <div className="mb-4">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4 lg:flex lg:w-fit lg:flex-wrap">
              <TabsTrigger value="prompts" className="min-w-0 gap-2 px-2 sm:px-3 lg:flex-none">
                <FileText className="h-4 w-4" />
                {tEssay('tabPrompts')}
              </TabsTrigger>
              <TabsTrigger value="cases" className="min-w-0 gap-2 px-2 sm:px-3 lg:flex-none">
                <BookOpen className="h-4 w-4" />
                {tEssay('tabCases')}
              </TabsTrigger>
              <TabsTrigger value="pipeline" className="min-w-0 gap-2 px-2 sm:px-3 lg:flex-none">
                <Workflow className="h-4 w-4" />
                {tEssay('tabPipeline')}
              </TabsTrigger>
              <TabsTrigger value="gallery-ai" className="min-w-0 gap-2 px-2 sm:px-3 lg:flex-none">
                <BarChart3 className="h-4 w-4" />
                {tEssay('tabGalleryAi')}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="prompts">
            <div className="mb-4 flex justify-end">
              <Button variant="outline" onClick={() => openImport('essay-prompts')}>
                <Upload className="mr-2 h-4 w-4" />
                {tEssay('importPrompts')}
              </Button>
            </div>
            <EssayPromptManager />
          </TabsContent>

          <TabsContent value="cases">
            <div className="mb-4 flex justify-end">
              <Button variant="outline" onClick={() => openImport('cases')}>
                <Upload className="mr-2 h-4 w-4" />
                {tEssay('importCases')}
              </Button>
            </div>
            <EssayCaseReviewManager />
          </TabsContent>

          <TabsContent value="pipeline">
            <EssayPipelineDashboard />
          </TabsContent>

          <TabsContent value="gallery-ai">
            <AdminGalleryAiMetrics />
          </TabsContent>
        </Tabs>
      </div>

      <BulkImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        importType={importType}
      />
    </>
  );
}
