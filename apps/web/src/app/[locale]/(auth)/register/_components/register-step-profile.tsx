'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const currentYear = new Date().getFullYear();
const birthYears = Array.from({ length: 50 }, (_, i) => currentYear - 10 - i);
const graduationYears = Array.from({ length: 10 }, (_, i) => currentYear + 5 - i);

const months = Array.from({ length: 12 }, (_, i) => ({
  value: (i + 1).toString().padStart(2, '0'),
  label: `${i + 1}`,
}));

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month, 0).getDate();
};

interface RegisterStepProfileProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
}

export function RegisterStepProfile({ form }: RegisterStepProfileProps) {
  const t = useTranslations();
  const ta = useTranslations('auth.register');

  const watchBirthYear = form.watch('birthYear');
  const watchBirthMonth = form.watch('birthMonth');

  const daysInMonth = useMemo(() => {
    if (watchBirthYear && watchBirthMonth) {
      return getDaysInMonth(parseInt(watchBirthYear, 10), parseInt(watchBirthMonth, 10));
    }
    return 31;
  }, [watchBirthYear, watchBirthMonth]);

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="realName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {ta('realName')} <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input placeholder={ta('realNamePlaceholder')} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-2">
        <FormLabel className="text-sm">
          {ta('birthday')}{' '}
          <span className="text-muted-foreground font-normal text-xs ml-1">
            {t('common.optional', { defaultValue: '' })}
          </span>
        </FormLabel>
        <div className="grid grid-cols-3 gap-2">
          <FormField
            control={form.control}
            name="birthYear"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="YYYY" />
                </SelectTrigger>
                <SelectContent>
                  {birthYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FormField
            control={form.control}
            name="birthMonth"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FormField
            control={form.control}
            name="birthDay"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="DD" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString().padStart(2, '0')}>
                      {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        <FormLabel className="text-sm">{ta('graduationDate')}</FormLabel>
        <div className="grid grid-cols-2 gap-2">
          <FormField
            control={form.control}
            name="gradYear"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="YYYY" />
                </SelectTrigger>
                <SelectContent>
                  {graduationYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FormField
            control={form.control}
            name="gradMonth"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
    </div>
  );
}
