'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Calendar, Target, Search, BookOpen, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import type { Essay } from '@/types/essay';

const STEP_ICONS = [Target, Search, BookOpen] as const;
const STEP_LINKS = ['/profile?tab=schools', 'action:create', '/cases?tab=essays'] as const;

function toValidDate(value: unknown) {
  if (!value) {
    return null;
  }

  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date;
}

interface EssayListSidebarProps {
  essays: Essay[] | undefined;
  isLoading: boolean;
  selectedEssayId: string | null;
  onSelect: (essay: Essay) => void;
  getWordCount: (text: string) => number;
  onCreate?: () => void;
}

export function EssayListSidebar({
  essays,
  isLoading,
  selectedEssayId,
  onSelect,
  getWordCount,
  onCreate,
}: EssayListSidebarProps) {
  const t = useTranslations();
  const fmt = useFormatter();

  return (
    <div className="lg:col-span-1">
      <Card className="overflow-hidden">
        <div className="h-1 bg-destructive" />
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10">
              <FileText className="h-4 w-4 text-rose-500" />
            </div>
            <CardTitle className="text-lg">{t('essays.list')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState variant="card" count={3} />
          ) : essays && essays.length > 0 ? (
            <ScrollArea className="h-[500px] pr-2">
              <div className="space-y-2">
                {essays.map((essay, index) => {
                  const updatedAt = toValidDate(essay.updatedAt);

                  return (
                    <motion.div
                      key={essay.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        'cursor-pointer rounded-xl border p-4 transition-all duration-200',
                        'hover:border-rose-500/40 hover:bg-rose-500/5 hover:shadow-sm',
                        selectedEssayId === essay.id && 'border-rose-500 bg-rose-500/5 shadow-sm'
                      )}
                      onClick={() => onSelect(essay)}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h4 className="font-semibold line-clamp-1">{essay.title}</h4>
                        <Badge variant="info" className="shrink-0">
                          {essay.wordCount || getWordCount(essay.content)} {t('common.words')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {essay.prompt || essay.content.slice(0, 100)}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {updatedAt ? fmt.dateTime(updatedAt, 'medium') : t('common.notAvailable')}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-6">
              <EmptyState
                icon={<FileText className="h-12 w-12" />}
                title={t('essays.empty.title')}
                description={t('essays.empty.description')}
                className="pb-4"
              />
              <div className="px-2 mb-3">
                <Link href="/profile?tab=schools">
                  <Button variant="default" className="w-full" size="sm">
                    <Target className="h-4 w-4 mr-2" />
                    {t('essays.startFromTargetSchool')}
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground text-center mt-1.5">
                  {t('essays.targetSchoolHint')}
                </p>
              </div>
              <div className="space-y-2 px-2" data-tour="essay-sidebar-tips">
                {([1, 2, 3] as const).map((step) => {
                  const Icon = STEP_ICONS[step - 1];
                  const link = STEP_LINKS[step - 1];
                  const isAction = link?.startsWith('action:');
                  const content = (
                    <div
                      className={cn(
                        'flex items-start gap-2.5 rounded-lg bg-muted/50 p-2.5 text-xs',
                        (link || isAction) && 'cursor-pointer transition-colors hover:bg-muted'
                      )}
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Icon className="h-3 w-3 text-primary" />
                      </div>
                      <span className="flex-1 text-muted-foreground">
                        {t(`essays.tips.step${step}`)}
                      </span>
                      {link && (
                        <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                  );

                  if (isAction && onCreate) {
                    return (
                      <button
                        key={step}
                        type="button"
                        onClick={onCreate}
                        className="w-full text-left"
                        aria-label={t(`essays.tips.step${step}`)}
                      >
                        {content}
                      </button>
                    );
                  }

                  return link && !isAction ? (
                    <Link key={step} href={link}>
                      {content}
                    </Link>
                  ) : (
                    <div key={step}>{content}</div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
