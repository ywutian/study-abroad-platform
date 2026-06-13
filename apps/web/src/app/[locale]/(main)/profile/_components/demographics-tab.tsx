'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { MAX_LEGACY_AFFILIATIONS } from '@study-abroad/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import { Globe } from 'lucide-react';
import { COMMON_COUNTRIES, EDUCATION_SYSTEMS } from './constants';
import type { Control } from 'react-hook-form';
import type { ProfileFormValues } from '@/lib/validations/profile';

interface DemographicsTabProps {
  control: Control<ProfileFormValues>;
}

export function DemographicsTab({ control }: DemographicsTabProps) {
  const t = useTranslations();

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-teal-500 dark:bg-teal-600" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-teal-500 dark:text-teal-400" />
          {t('profile.demographics.title')}
        </CardTitle>
        <CardDescription>{t('profile.demographics.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={control}
            name="nationality"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  {t('profile.demographics.nationality')}
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={t('profile.demographics.selectCountry')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {COMMON_COUNTRIES.map((c) => (
                      <SelectItem key={`nat-${c.value}`} value={c.value}>
                        {t(c.labelKey)}
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
            name="countryOfResidence"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  {t('profile.demographics.countryOfResidence')}
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={t('profile.demographics.selectCountry')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {COMMON_COUNTRIES.map((c) => (
                      <SelectItem key={`res-${c.value}`} value={c.value}>
                        {t(c.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={control}
            name="citizenship"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  {t('profile.demographics.citizenship')}
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={t('profile.demographics.selectCountry')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {COMMON_COUNTRIES.map((c) => (
                      <SelectItem key={`cit-${c.value}`} value={c.value}>
                        {t(c.labelKey)}
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
            name="educationSystem"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  {t('profile.demographics.educationSystem')}
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={t('profile.demographics.selectEducationSystem')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EDUCATION_SYSTEMS.map((es) => (
                      <SelectItem key={es.value} value={es.value}>
                        {t(es.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="space-y-4 pt-2">
          <FormField
            control={control}
            name="needsFinancialAid"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm cursor-pointer">
                  {t('profile.demographics.needsFinancialAid')}
                </FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="firstGeneration"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm cursor-pointer">
                  {t('profile.demographics.firstGeneration')}
                </FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="recruitedAthlete"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm cursor-pointer">
                  {t('profile.demographics.recruitedAthlete')}
                </FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="applyingTestOptional"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm cursor-pointer">
                  {t('profile.demographics.applyingTestOptional')}
                </FormLabel>
              </FormItem>
            )}
          />
        </div>

        {/* Legacy */}
        <FormField
          control={control}
          name="legacy"
          render={({ field }) => (
            <FormItem className="pt-4 border-t">
              <FormLabel className="text-sm font-medium">
                {t('profile.demographics.legacy')}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={t('profile.demographics.legacyPlaceholder')}
                  value={field.value.join(', ')}
                  onChange={(e) => {
                    const val = e.target.value;
                    let arr = val
                      ? val
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                      : [];
                    if (arr.length > MAX_LEGACY_AFFILIATIONS) {
                      toast.error(
                        t('profile.demographics.legacyTooMany', {
                          max: MAX_LEGACY_AFFILIATIONS,
                        })
                      );
                      arr = arr.slice(0, MAX_LEGACY_AFFILIATIONS);
                    }
                    field.onChange(arr);
                  }}
                />
              </FormControl>
              <FormDescription>{t('profile.demographics.legacyHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Intended Major & Second Major */}
        <div className="grid gap-6 sm:grid-cols-2 pt-4 border-t">
          <FormField
            control={control}
            name="intendedMajor"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  {t('profile.fields.intendedMajor')}
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t('profile.placeholders.intendedMajor')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="secondMajor"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  {t('profile.fields.secondMajor')}
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t('profile.placeholders.secondMajor')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
