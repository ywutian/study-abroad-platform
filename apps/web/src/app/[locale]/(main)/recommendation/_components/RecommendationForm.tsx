'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ComboboxTagInput } from '@/components/ui/combobox-tag-input';
import { PageTransition } from '@/components/ui/motion';
import { Slider } from '@/components/ui/slider';
import {
  MapPin,
  BookOpen,
  DollarSign,
  Sparkles,
  Target,
  GraduationCap,
  Building2,
  Sun,
  Users,
  Trophy as TrophyIcon,
} from 'lucide-react';
import { US_REGIONS, US_MAJORS } from '@study-abroad/shared';
import type { RecommendationPreflight } from '@study-abroad/shared';
import type { GenerateRecommendationDto } from '@/hooks/use-recommendation';

const BUDGET_OPTIONS = ['low', 'medium', 'high', 'unlimited'] as const;
const SCHOOL_COUNT_OPTIONS = [10, 15, 20] as const;

interface RecommendationFormProps {
  onGenerate: (dto: GenerateRecommendationDto) => void;
  preflight?: RecommendationPreflight;
}

export function RecommendationForm({ onGenerate, preflight }: RecommendationFormProps) {
  const t = useTranslations('recommendation');

  const [regions, setRegions] = useState<string[]>([]);
  const [majors, setMajors] = useState<string[]>([]);
  const [budget, setBudget] = useState<string>('');
  const [schoolCount, setSchoolCount] = useState<number>(15);
  const [additionalPreferences, setAdditionalPreferences] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);

  // Quiz preferences
  const [roiImportance, setRoiImportance] = useState(3);
  const [campusSize, setCampusSize] = useState('');
  const [locationType, setLocationType] = useState('');
  const [campusCulture, setCampusCulture] = useState('');
  const [weatherPref, setWeatherPref] = useState('');
  const [diversityImportance, setDiversityImportance] = useState(3);
  const [greekLife, setGreekLife] = useState(3);
  const [athleticsImportance, setAthleticsImportance] = useState(3);

  const canGenerate = preflight?.profileComplete ?? false;

  const handleSubmit = () => {
    if (!canGenerate) return;
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    const quizParts: string[] = [];
    if (roiImportance !== 3) quizParts.push(`ROI importance: ${roiImportance}/5`);
    if (campusSize) quizParts.push(`Campus size preference: ${campusSize}`);
    if (locationType) quizParts.push(`Location type: ${locationType}`);
    if (campusCulture) quizParts.push(`Campus culture: ${campusCulture}`);
    if (weatherPref) quizParts.push(`Weather preference: ${weatherPref}`);
    if (diversityImportance !== 3) quizParts.push(`Diversity importance: ${diversityImportance}/5`);
    if (greekLife !== 3) quizParts.push(`Greek life importance: ${greekLife}/5`);
    if (athleticsImportance !== 3) quizParts.push(`Athletics importance: ${athleticsImportance}/5`);

    const fullPreferences = [additionalPreferences, ...quizParts].filter(Boolean).join('\n');

    onGenerate({
      preferredRegions: regions.length > 0 ? regions : undefined,
      preferredMajors: majors.length > 0 ? majors : undefined,
      budget: budget || undefined,
      schoolCount,
      additionalPreferences: fullPreferences || undefined,
    });
  };

  return (
    <PageTransition className="grid gap-6 lg:grid-cols-2">
      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('preferences')}</CardTitle>
          <CardDescription>{t('preferencesDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Regions */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t('regions')}
            </Label>
            <ComboboxTagInput
              suggestions={US_REGIONS}
              selected={regions}
              onSelectedChange={setRegions}
              placeholder={t('regionsPlaceholder')}
              noMatchText={t('noMatchingRegions')}
            />
          </div>

          {/* Majors */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {t('majors')}
            </Label>
            <ComboboxTagInput
              suggestions={US_MAJORS}
              selected={majors}
              onSelectedChange={setMajors}
              placeholder={t('majorsPlaceholder')}
              noMatchText={t('noMatchingMajors')}
            />
          </div>

          {/* Budget + School Count row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {t('budget')}
              </Label>
              <Select value={budget} onValueChange={setBudget}>
                <SelectTrigger>
                  <SelectValue placeholder={t('budgetPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {t(`budgetOptions.${opt}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                {t('schoolCountLabel')}
              </Label>
              <Select value={String(schoolCount)} onValueChange={(v) => setSchoolCount(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHOOL_COUNT_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {t(`schoolCountOptions.${n}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional */}
          <div className="space-y-2">
            <Label>{t('additional')}</Label>
            <Textarea
              placeholder={t('additionalPlaceholder')}
              value={additionalPreferences}
              onChange={(e) => setAdditionalPreferences(e.target.value)}
              rows={3}
              maxLength={500}
            />
            {additionalPreferences.length > 0 && (
              <p className="text-xs text-muted-foreground text-right">
                {t('maxChars', {
                  count: additionalPreferences.length,
                  max: 500,
                })}
              </p>
            )}
          </div>

          {/* Preference Quiz Toggle */}
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowQuiz(!showQuiz)}
            >
              {showQuiz ? t('quiz.hidePreferences') : t('quiz.showPreferences')}
            </Button>
          </div>

          {showQuiz && (
            <div className="space-y-4 pt-2 border-t">
              <p className="text-sm font-medium text-muted-foreground">{t('quiz.title')}</p>

              {/* ROI Importance */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4" />
                  {t('quiz.roiImportance')}
                </Label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground shrink-0">{t('quiz.low')}</span>
                  <Slider
                    value={[roiImportance]}
                    onValueChange={([v]) => setRoiImportance(v)}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">{t('quiz.high')}</span>
                </div>
              </div>

              {/* Campus Size */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4" />
                  {t('quiz.campusSize')}
                </Label>
                <Select value={campusSize} onValueChange={setCampusSize}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('quiz.selectOne')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">{t('quiz.sizeSmall')}</SelectItem>
                    <SelectItem value="medium">{t('quiz.sizeMedium')}</SelectItem>
                    <SelectItem value="large">{t('quiz.sizeLarge')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Location Type */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  {t('quiz.locationType')}
                </Label>
                <Select value={locationType} onValueChange={setLocationType}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('quiz.selectOne')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urban">{t('quiz.urban')}</SelectItem>
                    <SelectItem value="suburban">{t('quiz.suburban')}</SelectItem>
                    <SelectItem value="rural">{t('quiz.rural')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Campus Culture */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  {t('quiz.campusCulture')}
                </Label>
                <Select value={campusCulture} onValueChange={setCampusCulture}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('quiz.selectOne')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="research">{t('quiz.research')}</SelectItem>
                    <SelectItem value="liberal-arts">{t('quiz.liberalArts')}</SelectItem>
                    <SelectItem value="pre-professional">{t('quiz.preProfessional')}</SelectItem>
                    <SelectItem value="balanced">{t('quiz.balanced')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Weather */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Sun className="h-4 w-4" />
                  {t('quiz.weather')}
                </Label>
                <Select value={weatherPref} onValueChange={setWeatherPref}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('quiz.selectOne')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warm">{t('quiz.warm')}</SelectItem>
                    <SelectItem value="moderate">{t('quiz.moderate')}</SelectItem>
                    <SelectItem value="cold">{t('quiz.cold')}</SelectItem>
                    <SelectItem value="no-preference">{t('quiz.noPreference')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Diversity Importance */}
              <div className="space-y-2">
                <Label className="text-sm">{t('quiz.diversityImportance')}</Label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground shrink-0">{t('quiz.low')}</span>
                  <Slider
                    value={[diversityImportance]}
                    onValueChange={([v]) => setDiversityImportance(v)}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">{t('quiz.high')}</span>
                </div>
              </div>

              {/* Greek Life */}
              <div className="space-y-2">
                <Label className="text-sm">{t('quiz.greekLife')}</Label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground shrink-0">{t('quiz.low')}</span>
                  <Slider
                    value={[greekLife]}
                    onValueChange={([v]) => setGreekLife(v)}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">{t('quiz.high')}</span>
                </div>
              </div>

              {/* Athletics */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <TrophyIcon className="h-4 w-4" />
                  {t('quiz.athletics')}
                </Label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground shrink-0">{t('quiz.low')}</span>
                  <Slider
                    value={[athleticsImportance]}
                    onValueChange={([v]) => setAthleticsImportance(v)}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">{t('quiz.high')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="pt-4">
            <Button onClick={handleSubmit} disabled={!canGenerate} className="w-full" size="lg">
              <Sparkles className="mr-2 h-5 w-5" />
              {t('generateBtn')}
            </Button>
            {!canGenerate && (
              <p className="text-xs text-destructive text-center mt-2">{t('profileIncomplete')}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* How It Works Info Card */}
      <Card className="bg-primary/5 border-primary/10">
        <CardHeader>
          <CardTitle className="text-lg">{t('howItWorks')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { icon: Target, titleKey: 'step1Title', descKey: 'step1Desc' },
            { icon: Sparkles, titleKey: 'step2Title', descKey: 'step2Desc' },
            {
              icon: GraduationCap,
              titleKey: 'step3Title',
              descKey: 'step3Desc',
            },
          ].map(({ icon: Icon, titleKey, descKey }) => (
            <div key={titleKey} className="flex gap-3">
              <div className="p-2 rounded-lg bg-primary/10 h-fit">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{t(titleKey)}</p>
                <p className="text-sm text-muted-foreground">{t(descKey)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        type="info"
        title={t('confirmTitle')}
        description={t('confirmDescSimple')}
        confirmLabel={t('confirmGenerate')}
        cancelLabel={t('cancel')}
        onConfirm={handleConfirm}
      />
    </PageTransition>
  );
}
