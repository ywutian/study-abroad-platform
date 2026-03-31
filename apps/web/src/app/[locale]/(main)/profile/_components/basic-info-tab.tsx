'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { User } from 'lucide-react';
import { GRADES, BUDGET_TIERS } from './constants';
import type { Control } from 'react-hook-form';
import type { ProfileFormValues } from '@/lib/validations/profile';

interface BasicInfoTabProps {
  control: Control<ProfileFormValues>;
}

export function BasicInfoTab({ control }: BasicInfoTabProps) {
  const t = useTranslations();

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-primary" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          {t('profile.basicInfo')}
        </CardTitle>
        <CardDescription>{t('profile.basicInfoDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={control}
            name="grade"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">{t('profile.fields.grade')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={t('profile.placeholders.selectGrade')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {GRADES.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {t(g.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="currentSchool"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  {t('profile.fields.currentSchool')}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t('profile.fields.currentSchoolPlaceholder')}
                    className="h-11"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={control}
          name="targetMajor"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">
                {t('profile.fields.targetMajor')}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('profile.fields.targetMajorPlaceholder')}
                  className="h-11"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="budgetTier"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">{t('profile.fields.budget')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={t('profile.placeholders.selectBudget')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BUDGET_TIERS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {t(b.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
