'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { IssueCard } from './issue-card';
import type { SectionFeedback, SectionIssue } from '@study-abroad/shared';

interface SectionTabProps {
  sectionFeedback: SectionFeedback[];
  onApplySuggestion?: (sectionId: string, issue: SectionIssue) => boolean;
}

export function SectionTab({ sectionFeedback, onApplySuggestion }: SectionTabProps) {
  const t = useTranslations('resume.aiReview');
  const [appliedSet, setAppliedSet] = useState<Set<string>>(new Set());

  const handleApply = useCallback(
    (sf: SectionFeedback, issue: SectionIssue, issueIdx: number) => {
      if (!sf.sectionId || !onApplySuggestion) return;
      const success = onApplySuggestion(sf.sectionId, issue);
      if (success) {
        setAppliedSet((prev) => {
          const next = new Set(prev);
          next.add(`${sf.sectionType}-${issueIdx}`);
          return next;
        });
      }
    },
    [onApplySuggestion]
  );

  const feedbackWithIssues = sectionFeedback.filter((sf) => sf.issues.length > 0);

  if (feedbackWithIssues.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        {t('noIssues')}
      </div>
    );
  }

  // Sort by issue count descending
  const sorted = [...feedbackWithIssues].sort((a, b) => b.issues.length - a.issues.length);

  return (
    <Accordion type="multiple" defaultValue={[sorted[0]?.sectionType]}>
      {sorted.map((sf) => {
        const highCount = sf.issues.filter((i) => i.severity === 'high').length;

        return (
          <AccordionItem key={sf.sectionType} value={sf.sectionType}>
            <AccordionTrigger className="py-3 text-sm hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="font-medium">{sf.sectionTitle}</span>
                <Badge variant="secondary" className="text-2xs">
                  {sf.issues.length} {t('issues')}
                </Badge>
                {highCount > 0 && (
                  <Badge variant="destructive" className="text-2xs">
                    {highCount} {t('severity.high')}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {sf.issues.map((issue, idx) => (
                  <IssueCard
                    key={idx}
                    issue={issue}
                    applied={appliedSet.has(`${sf.sectionType}-${idx}`)}
                    onApply={
                      sf.sectionId && onApplySuggestion
                        ? () => handleApply(sf, issue, idx)
                        : undefined
                    }
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
