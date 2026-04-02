'use client';

import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormItem, FormLabel } from '@/components/ui/form';

type ScoreField = 'toeflScore' | 'ieltsScore' | 'satScore' | 'actScore';

interface RegisterStepScoresProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  values: Record<ScoreField, string>;
  onValueChange: (field: ScoreField, value: string) => void;
}

export function RegisterStepScores({ form, values, onValueChange }: RegisterStepScoresProps) {
  const ta = useTranslations('auth.register');
  const updateValue = (field: ScoreField, value: string) => {
    onValueChange(field, value);
    form.setValue(field, value, {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <FormItem>
          <FormLabel className="text-sm">
            TOEFL <span className="text-muted-foreground font-normal text-xs">/ 120</span>
          </FormLabel>
          <Input
            type="number"
            placeholder="-"
            min={0}
            max={120}
            name="toeflScore"
            value={values.toeflScore}
            onChange={(event) => updateValue('toeflScore', event.target.value)}
          />
        </FormItem>
        <FormItem>
          <FormLabel className="text-sm">
            IELTS <span className="text-muted-foreground font-normal text-xs">/ 9.0</span>
          </FormLabel>
          <Input
            type="number"
            placeholder="-"
            min={0}
            max={9}
            step={0.5}
            name="ieltsScore"
            value={values.ieltsScore}
            onChange={(event) => updateValue('ieltsScore', event.target.value)}
          />
        </FormItem>
        <FormItem>
          <FormLabel className="text-sm">
            SAT <span className="text-muted-foreground font-normal text-xs">/ 1600</span>
          </FormLabel>
          <Input
            type="number"
            placeholder="-"
            min={400}
            max={1600}
            name="satScore"
            value={values.satScore}
            onChange={(event) => updateValue('satScore', event.target.value)}
          />
        </FormItem>
        <FormItem>
          <FormLabel className="text-sm">
            ACT <span className="text-muted-foreground font-normal text-xs">/ 36</span>
          </FormLabel>
          <Input
            type="number"
            placeholder="-"
            min={1}
            max={36}
            name="actScore"
            value={values.actScore}
            onChange={(event) => updateValue('actScore', event.target.value)}
          />
        </FormItem>
      </div>
      <p className="text-xs text-muted-foreground text-center pt-2">{ta('scoresOptional')}</p>
    </div>
  );
}
