'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

type CaseResult = 'ADMITTED' | 'REJECTED' | 'WAITLISTED';

interface CaseCardProps {
  schoolName: string;
  year: number;
  round?: string;
  major?: string;
  result: CaseResult;
  gpa?: string;
  sat?: string;
  toefl?: string;
  tags?: string[];
  className?: string;
  onClick?: () => void;
}

const resultConfig: Record<CaseResult, { label: string; className: string }> = {
  ADMITTED: {
    label: '录取',
    className: 'bg-success/10 text-success border-success/20',
  },
  REJECTED: {
    label: '拒绝',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  WAITLISTED: {
    label: '候补',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
};

export function CaseCard({
  schoolName,
  year,
  round = 'RD',
  major = 'Undeclared',
  result,
  gpa,
  sat,
  toefl,
  tags,
  className,
  onClick,
}: CaseCardProps) {
  const resultInfo = resultConfig[result];

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{schoolName}</h3>
            <p className="text-sm text-muted-foreground">
              {year} · {round} · {major}
            </p>
          </div>
          <Badge variant="outline" className={cn('shrink-0', resultInfo.className)}>
            {resultInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-2 text-sm">
          {gpa && (
            <div>
              <span className="text-muted-foreground">GPA:</span>{' '}
              <span className="font-medium">{gpa}</span>
            </div>
          )}
          {sat && (
            <div>
              <span className="text-muted-foreground">SAT:</span>{' '}
              <span className="font-medium">{sat}</span>
            </div>
          )}
          {toefl && (
            <div>
              <span className="text-muted-foreground">TOEFL:</span>{' '}
              <span className="font-medium">{toefl}</span>
            </div>
          )}
        </div>
        {tags && tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {tags.slice(0, 4).map((tag, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {tags.length > 4 && (
              <Badge variant="secondary" className="text-xs">
                +{tags.length - 4}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}





