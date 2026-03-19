'use client';

import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';

interface RegisterStepScoresProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
}

export function RegisterStepScores({ form }: RegisterStepScoresProps) {
  const ta = useTranslations('auth.register');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <FormField
          control={form.control}
          name="toeflScore"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">
                TOEFL <span className="text-muted-foreground font-normal text-xs">/ 120</span>
              </FormLabel>
              <FormControl>
                <Input type="number" placeholder="-" min={0} max={120} {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ieltsScore"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">
                IELTS <span className="text-muted-foreground font-normal text-xs">/ 9.0</span>
              </FormLabel>
              <FormControl>
                <Input type="number" placeholder="-" min={0} max={9} step={0.5} {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="satScore"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">
                SAT <span className="text-muted-foreground font-normal text-xs">/ 1600</span>
              </FormLabel>
              <FormControl>
                <Input type="number" placeholder="-" min={400} max={1600} {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="actScore"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">
                ACT <span className="text-muted-foreground font-normal text-xs">/ 36</span>
              </FormLabel>
              <FormControl>
                <Input type="number" placeholder="-" min={1} max={36} {...field} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center pt-2">{ta('scoresOptional')}</p>
    </div>
  );
}
