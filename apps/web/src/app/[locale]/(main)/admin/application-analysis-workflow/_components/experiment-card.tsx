import type { KeyboardEvent, MouseEvent } from 'react';

import type { PaginatedApplicationAnalysisExperimentResponse } from '@study-abroad/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { humanizeEnum } from './utils';

type Experiment = PaginatedApplicationAnalysisExperimentResponse['items'][number];

interface ExperimentCardProps {
  experiment: Experiment;
  selected: boolean;
  labels: {
    promoteShadow: string;
    refreshEvaluation: string;
    promoteCanary: string;
    activate: string;
    retire: string;
  };
  onSelect: () => void;
  onShadow: () => void;
  onEvaluate: () => void;
  onCanary: () => void;
  onActivate: () => void;
  onRetire: () => void;
}

export function ExperimentCard({
  experiment,
  selected,
  labels,
  onSelect,
  onShadow,
  onEvaluate,
  onCanary,
  onActivate,
  onRetire,
}: ExperimentCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };
  const action = (callback: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    callback();
  };

  return (
    <div
      className="rounded-lg border p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="font-medium">
            {experiment.capability} · {experiment.version}
          </div>
          <div className="text-sm text-muted-foreground">
            {experiment.methodVersion} · {experiment.policyVersion?.version ?? 'No linked policy'}
          </div>
        </div>
        <Badge variant="outline">{humanizeEnum(experiment.status)}</Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {experiment.status === 'DRAFT' ? (
          <Button size="sm" variant="outline" onClick={action(onShadow)}>
            {labels.promoteShadow}
          </Button>
        ) : null}
        {experiment.status === 'SHADOW' || experiment.status === 'CANARY' ? (
          <Button size="sm" variant="outline" onClick={action(onEvaluate)}>
            {labels.refreshEvaluation}
          </Button>
        ) : null}
        {experiment.status === 'SHADOW' ? (
          <Button size="sm" variant="outline" onClick={action(onCanary)}>
            {labels.promoteCanary}
          </Button>
        ) : null}
        {experiment.status === 'CANARY' ? (
          <Button size="sm" variant="outline" onClick={action(onActivate)}>
            {labels.activate}
          </Button>
        ) : null}
        {experiment.status === 'ACTIVE' ? (
          <Button size="sm" variant="outline" onClick={action(onRetire)}>
            {labels.retire}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
