'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { PenTool, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/layout';

import { useEssayManager } from './_components/use-essay-manager';
import { EssayWorkbench } from './_components/essay-workbench';
import { EssayDeleteDialog, EssayFormDialog } from './_components/essay-form-dialog';

export default function EssaysPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const schoolId = searchParams.get('schoolId');
  const promptId = searchParams.get('promptId');
  const mgr = useEssayManager(schoolId, promptId);

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title={t('essays.title')}
        description={t('essays.description')}
        icon={PenTool}
        color="rose"
        actions={
          <Button data-tour="essay-new" onClick={mgr.handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('essays.new')}
          </Button>
        }
      />

      <EssayWorkbench
        essays={mgr.essays}
        isLoading={mgr.isLoading}
        selectedEssay={mgr.selectedEssay}
        onSelect={mgr.setSelectedEssay}
        onCreate={mgr.handleCreate}
        onCreateFromPrompt={mgr.handleCreateFromPrompt}
        onDelete={mgr.handleDelete}
        onSave={mgr.saveEssay}
        isSaving={mgr.isSaving}
        getWordCount={mgr.getWordCount}
      />

      <EssayFormDialog
        isFormOpen={mgr.isFormOpen}
        setIsFormOpen={mgr.setIsFormOpen}
        selectedEssay={mgr.selectedEssay}
        essayForm={mgr.essayForm}
        onSubmit={mgr.handleSubmit}
        isSaving={mgr.isSaving}
        getWordCount={mgr.getWordCount}
        essayPromptId={mgr.essayPromptId}
        onEssayPromptIdChange={mgr.setEssayPromptId}
        initialSchoolId={mgr.initialSchoolId}
        autoOpenPromptSelector={mgr.autoOpenPromptSelector}
      />

      <EssayDeleteDialog
        isDeleteOpen={mgr.isDeleteOpen}
        setIsDeleteOpen={mgr.setIsDeleteOpen}
        onConfirmDelete={mgr.confirmDelete}
        isDeleting={mgr.isDeleting}
      />
    </PageContainer>
  );
}
