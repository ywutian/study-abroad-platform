'use client';

import { useTranslations } from 'next-intl';
import { Target, Zap, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/layout';

interface PredictionHeaderProps {
  dataCompleteness?: number;
}

export function PredictionHeader({ dataCompleteness }: PredictionHeaderProps) {
  const t = useTranslations();

  return (
    <PageHeader
      title={t('prediction.title')}
      description={t('prediction.selectSchoolsDesc')}
      icon={Target}
      color="blue"
    >
      <div className="mt-3 flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          <Zap className="h-3 w-3 mr-1" />
          {t('prediction.badge.ensemble')}
        </Badge>
        {dataCompleteness !== undefined && (
          <Badge variant="outline" className="text-xs">
            {t('prediction.dataCompleteness')}: {dataCompleteness}%
          </Badge>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">{t('prediction.tooltip.ensemble')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </PageHeader>
  );
}
