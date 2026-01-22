'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout';
import {
  EssayPromptManager,
  EssayCaseReviewManager,
  BulkImportDialog,
  EssayPipelineDashboard,
} from '@/components/features';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PenTool, Upload, FileText, BookOpen, Workflow } from 'lucide-react';

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
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="prompts" className="gap-2">
                <FileText className="h-4 w-4" />
                {tEssay('tabPrompts')}
              </TabsTrigger>
              <TabsTrigger value="cases" className="gap-2">
                <BookOpen className="h-4 w-4" />
                {tEssay('tabCases')}
              </TabsTrigger>
              <TabsTrigger value="pipeline" className="gap-2">
                <Workflow className="h-4 w-4" />
                {tEssay('tabPipeline')}
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
