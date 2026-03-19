'use client';

import { useTranslations } from 'next-intl';
import { Plus, PenTool, Sparkles, Wand2, Lightbulb, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/layout';
import { AIErrorBoundary } from '@/components/features/ai-error-boundary';
import { AiAssistantPanel } from '@/components/features/agent-chat';
import { EssayBrainstormDialog } from '@/components/features/essay-ai';
import { toast } from 'sonner';

import { useEssayManager } from './_components/use-essay-manager';
import { EssayListSidebar } from './_components/essay-list-sidebar';
import { EssayDetailView } from './_components/essay-detail-view';
import { EssayAIDialogs } from './_components/essay-ai-dialogs';
import { EssayFormDialog, EssayDeleteDialog } from './_components/essay-form-dialog';

export default function EssaysPage() {
  const t = useTranslations();
  const mgr = useEssayManager();

  const handleRewriteSelected = () => {
    const selection = window.getSelection()?.toString();
    if (selection) {
      mgr.setSelectedText(selection);
      mgr.setRewriteInstruction('');
      mgr.handleRewrite();
    } else {
      toast.error(t('essays.toast.selectParagraph'));
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={t('essays.title')}
        description={t('essays.description')}
        icon={PenTool}
        color="rose"
        actions={
          <Button
            onClick={mgr.handleCreate}
            className="gap-2 bg-destructive hover:opacity-90 text-white shadow-md"
          >
            <Plus className="h-4 w-4" />
            {t('essays.new')}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <EssayListSidebar
          essays={mgr.essays}
          isLoading={mgr.isLoading}
          selectedEssayId={mgr.selectedEssay?.id ?? null}
          onSelect={mgr.setSelectedEssay}
          getWordCount={mgr.getWordCount}
        />

        <EssayDetailView
          selectedEssay={mgr.selectedEssay}
          getWordCount={mgr.getWordCount}
          onCreate={mgr.handleCreate}
          onEdit={mgr.handleEdit}
          onDelete={mgr.handleDelete}
          onReview={mgr.handleReview}
          onPolish={mgr.handlePolish}
          onContinue={mgr.handleContinue}
          onGenerateOpening={mgr.handleGenerateOpening}
          onBrainstorm={() => mgr.setIsBrainstormOpen(true)}
          onRewriteSelected={handleRewriteSelected}
          reviewPending={mgr.reviewMutation.isPending}
          polishPending={mgr.polishMutation.isPending}
          rewritePending={mgr.rewriteMutation.isPending}
          continuePending={mgr.continueMutation.isPending}
          openingPending={mgr.openingMutation.isPending}
        />
      </div>

      <EssayFormDialog
        isFormOpen={mgr.isFormOpen}
        setIsFormOpen={mgr.setIsFormOpen}
        selectedEssay={mgr.selectedEssay}
        essayForm={mgr.essayForm}
        onSubmit={mgr.handleSubmit}
        isSaving={mgr.isSaving}
        getWordCount={mgr.getWordCount}
      />

      <EssayDeleteDialog
        isDeleteOpen={mgr.isDeleteOpen}
        setIsDeleteOpen={mgr.setIsDeleteOpen}
        onConfirmDelete={mgr.confirmDelete}
        isDeleting={mgr.isDeleting}
      />

      <AIErrorBoundary feature="essay-review">
        <EssayAIDialogs
          selectedEssay={mgr.selectedEssay}
          isReviewOpen={mgr.isReviewOpen}
          setIsReviewOpen={mgr.setIsReviewOpen}
          reviewResult={mgr.reviewResult}
          derivedScores={mgr.derivedScores}
          onReReview={() => mgr.selectedEssay && mgr.handleReview(mgr.selectedEssay)}
          isPolishOpen={mgr.isPolishOpen}
          setIsPolishOpen={mgr.setIsPolishOpen}
          polishResult={mgr.polishResult}
          onApplyPolish={mgr.applyPolishedContent}
          isContinueOpen={mgr.isContinueOpen}
          setIsContinueOpen={mgr.setIsContinueOpen}
          continueResult={mgr.continueResult}
          onAppendContinuation={mgr.appendContinuation}
          isOpeningOpen={mgr.isOpeningOpen}
          setIsOpeningOpen={mgr.setIsOpeningOpen}
          openingResult={mgr.openingResult}
          isRewriteOpen={mgr.isRewriteOpen}
          setIsRewriteOpen={mgr.setIsRewriteOpen}
          rewriteResult={mgr.rewriteResult}
          copiedIndex={mgr.copiedIndex}
          onCopyToClipboard={mgr.copyToClipboard}
        />
      </AIErrorBoundary>

      <EssayBrainstormDialog
        open={mgr.isBrainstormOpen}
        onOpenChange={mgr.setIsBrainstormOpen}
        initialPrompt={mgr.selectedEssay?.prompt ?? ''}
        onSelectIdea={(idea) => {
          if (mgr.selectedEssay) {
            const newContent = mgr.selectedEssay.content
              ? `${mgr.selectedEssay.content}\n\n${idea}`
              : idea;
            mgr.updateMutation.mutate({
              id: mgr.selectedEssay.id,
              data: { title: mgr.selectedEssay.title, content: newContent },
            });
          }
        }}
      />

      <AIErrorBoundary feature="agent-chat">
        <AiAssistantPanel
          contextTitle={
            mgr.selectedEssay
              ? t('essays.aiAssistant.currentEssay', { title: mgr.selectedEssay.title })
              : t('essays.aiAssistant.title')
          }
          contextDescription={
            mgr.selectedEssay
              ? t('essays.aiAssistant.selectedDesc', { title: mgr.selectedEssay.title })
              : t('essays.aiAssistant.defaultDesc')
          }
          contextActions={
            mgr.selectedEssay
              ? [
                  {
                    id: 'review',
                    icon: <Sparkles className="h-3.5 w-3.5" />,
                    label: t('essays.aiActions.review'),
                    message: t('essays.aiMessages.review', {
                      title: mgr.selectedEssay.title,
                      content: mgr.selectedEssay.content.slice(0, 500),
                    }),
                  },
                  {
                    id: 'polish',
                    icon: <Wand2 className="h-3.5 w-3.5" />,
                    label: t('essays.aiActions.polish'),
                    message: t('essays.aiMessages.polish', { title: mgr.selectedEssay.title }),
                  },
                  {
                    id: 'brainstorm',
                    icon: <Lightbulb className="h-3.5 w-3.5" />,
                    label: t('essays.aiActions.brainstorm'),
                    message: mgr.selectedEssay.prompt
                      ? t('essays.aiMessages.brainstormWithPrompt', {
                          prompt: mgr.selectedEssay.prompt,
                        })
                      : t('essays.aiMessages.brainstormWithTitle', {
                          title: mgr.selectedEssay.title,
                        }),
                  },
                ]
              : [
                  {
                    id: 'help',
                    icon: <HelpCircle className="h-3.5 w-3.5" />,
                    label: t('essays.aiActions.askQuestion'),
                    message: t('essays.aiActions.askQuestionMessage'),
                  },
                ]
          }
          triggerPosition="fixed"
          panelWidth="md"
        />
      </AIErrorBoundary>
    </PageContainer>
  );
}
