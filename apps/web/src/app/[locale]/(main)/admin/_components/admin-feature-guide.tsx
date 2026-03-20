'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface FieldSpec {
  name: string;
  description: string;
  required?: boolean;
}

export interface AdminFeatureGuideProps {
  title: string;
  steps?: string[];
  fields?: FieldSpec[];
  warnings?: string[];
  tips?: string[];
  defaultOpen?: boolean;
  className?: string;
}

export function AdminFeatureGuide({
  title,
  steps,
  fields,
  warnings,
  tips,
  defaultOpen = false,
  className,
}: AdminFeatureGuideProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <Card className="border-dashed">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            {title}
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-4">
            {steps && steps.length > 0 && (
              <ol className="space-y-2 text-sm text-muted-foreground">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            )}

            {fields && fields.length > 0 && (
              <div className="space-y-1">
                {fields.map((field) => (
                  <div key={field.name} className="flex items-start gap-2 text-sm">
                    <span className="font-medium min-w-[100px]">
                      {field.name}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                    </span>
                    <span className="text-muted-foreground">{field.description}</span>
                  </div>
                ))}
              </div>
            )}

            {warnings && warnings.length > 0 && (
              <div className="space-y-2">
                {warnings.map((warning, i) => (
                  <Alert key={i} variant="warning" className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{warning}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {tips && tips.length > 0 && (
              <div className="space-y-2">
                {tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
