'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHighSchoolSearch } from '@/hooks/use-high-school-search';

const CURRICULA = ['AP', 'IB', 'A_LEVEL', 'GAOKAO', 'CANADIAN', 'AUSTRALIAN', 'OTHER'] as const;
const AID_OPTIONS = [
  'no_aid',
  'need_based',
  'merit',
  'need_and_merit',
  'full_tuition',
  'full_ride',
  'loan_only',
  'none_received',
  'unknown',
] as const;
const DEMOGRAPHIC_OPTIONS = [
  'international',
  'first_gen',
  'legacy',
  'urm',
  'recruited_athlete',
  'low_income',
  'transfer',
  'homeschool',
  'military',
  'gap_year',
] as const;

interface BackgroundSectionProps {
  highSchoolId: string;
  highSchoolName: string;
  curriculum: string;
  nationality: string;
  demographics: Set<string>;
  financialAid: string;
  dialogOpen: boolean;
  onFieldChange: (field: string, value: string) => void;
  onDemographicsChange: (demographics: Set<string>) => void;
  onHighSchoolSelect: (id: string, name: string) => void;
}

export function BackgroundSection({
  highSchoolId,
  highSchoolName,
  curriculum,
  nationality,
  demographics,
  financialAid,
  dialogOpen,
  onFieldChange,
  onDemographicsChange,
  onHighSchoolSelect,
}: BackgroundSectionProps) {
  const t = useTranslations('admin.dataReview.manualEntry.caseForm');
  const te = useTranslations('admin.dataReview.enums');
  const locale = useLocale();

  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [hsQuery, setHsQuery] = useState('');
  const [showHsDropdown, setShowHsDropdown] = useState(false);

  const { data: highSchools } = useHighSchoolSearch(hsQuery, dialogOpen);

  return (
    <Collapsible open={backgroundOpen} onOpenChange={setBackgroundOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
        >
          {t('background')}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${backgroundOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-3">
        {/* High school search */}
        <div className="space-y-1.5 relative">
          <Label>{t('highSchool')}</Label>
          <Input
            placeholder={t('highSchoolSearch')}
            value={highSchoolId ? highSchoolName : hsQuery}
            onChange={(e) => {
              setHsQuery(e.target.value);
              onHighSchoolSelect('', '');
              setShowHsDropdown(true);
            }}
            onFocus={() => setShowHsDropdown(true)}
          />
          {showHsDropdown && highSchools && highSchools.length > 0 && !highSchoolId && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto">
              {highSchools.map((hs) => (
                <button
                  key={hs.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                  onClick={() => {
                    onHighSchoolSelect(hs.id, locale === 'zh' && hs.nameZh ? hs.nameZh : hs.name);
                    setShowHsDropdown(false);
                  }}
                >
                  <span className="font-medium">
                    {locale === 'zh' && hs.nameZh ? hs.nameZh : hs.name}
                  </span>
                  {hs.tier && (
                    <span className="text-muted-foreground ml-2 text-xs">T{hs.tier}</span>
                  )}
                  {(hs.city || hs.state) && (
                    <span className="text-muted-foreground ml-1 text-xs">
                      · {[hs.city, hs.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {highSchoolId && (
            <button
              type="button"
              className="absolute right-2 top-[calc(50%+4px)] text-muted-foreground hover:text-foreground text-xs"
              onClick={() => {
                onHighSchoolSelect('', '');
                setHsQuery('');
              }}
            >
              ✕
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>{t('nationality')}</Label>
          <Input
            value={nationality}
            onChange={(e) => onFieldChange('nationality', e.target.value)}
            placeholder={te('nationalityPlaceholder')}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('curriculum')}</Label>
          <Select value={curriculum} onValueChange={(v) => onFieldChange('curriculum', v)}>
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {CURRICULA.map((c) => (
                <SelectItem key={c} value={c}>
                  {te(`curriculum.${c}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('financialAid')}</Label>
          <Select value={financialAid} onValueChange={(v) => onFieldChange('financialAid', v)}>
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {AID_OPTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {te(`financialAid.${a}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('demographics')}</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {DEMOGRAPHIC_OPTIONS.map((tag) => {
              const active = demographics.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    const next = new Set(demographics);
                    if (next.has(tag)) next.delete(tag);
                    else next.add(tag);
                    onDemographicsChange(next);
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  )}
                >
                  {te(`demographic.${tag}`)}
                </button>
              );
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
