'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown } from 'lucide-react';

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

interface DetailsSectionProps {
  nationality: string;
  actRange: string;
  apCount: string;
  apSubjects: string;
  ibScore: string;
  narrative: string;
  demographicTags: string[];
  onFieldChange: (field: string, value: string) => void;
  onDemographicTagsChange: (tags: string[]) => void;
}

export function DetailsSection({
  nationality,
  actRange,
  apCount,
  apSubjects,
  ibScore,
  narrative,
  demographicTags,
  onFieldChange,
  onDemographicTagsChange,
}: DetailsSectionProps) {
  const t = useTranslations('submitCase');
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="border-t pt-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setShowDetails(!showDetails)}
      >
        {t('detailsToggle')}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
        />
      </button>

      {showDetails && (
        <div className="mt-3 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('nationalityLabel')}</Label>
              <Input
                placeholder={t('nationalityPlaceholder')}
                value={nationality}
                onChange={(e) => onFieldChange('nationality', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('actLabel')}</Label>
              <Input
                placeholder={t('actPlaceholder')}
                value={actRange}
                onChange={(e) => onFieldChange('actRange', e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{t('apCountLabel')}</Label>
              <Input
                type="number"
                min="0"
                max="30"
                placeholder="0"
                value={apCount}
                onChange={(e) => onFieldChange('apCount', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('apSubjectsLabel')}</Label>
              <Input
                placeholder={t('apSubjectsPlaceholder')}
                value={apSubjects}
                onChange={(e) => onFieldChange('apSubjects', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('ibScoreLabel')}</Label>
              <Input
                type="number"
                min="0"
                max="45"
                placeholder="0-45"
                value={ibScore}
                onChange={(e) => onFieldChange('ibScore', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('demographicTagsLabel')}</Label>
            <div className="flex flex-wrap gap-2">
              {DEMOGRAPHIC_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    demographicTags.includes(tag)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                  onClick={() =>
                    onDemographicTagsChange(
                      demographicTags.includes(tag)
                        ? demographicTags.filter((t) => t !== tag)
                        : [...demographicTags, tag]
                    )
                  }
                >
                  {t(`demographic.${tag}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('narrativeLabel')}</Label>
            <Textarea
              placeholder={t('narrativePlaceholder')}
              value={narrative}
              onChange={(e) => onFieldChange('narrative', e.target.value)}
              rows={4}
            />
          </div>
        </div>
      )}
    </div>
  );
}
