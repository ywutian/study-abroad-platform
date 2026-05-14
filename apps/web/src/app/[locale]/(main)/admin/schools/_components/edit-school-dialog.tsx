'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getSchoolName } from '@/lib/utils';
import { Loader2, ImageIcon } from 'lucide-react';
import {
  resolveSchoolTestingPolicyValue,
  toLegacyTestOptionalFlag,
} from '@study-abroad/shared/utils';

type TestingPolicyValue = 'REQUIRED' | 'OPTIONAL' | 'BLIND' | 'UNKNOWN';

interface School {
  id: string;
  name: string;
  nameZh?: string;
  logoUrl?: string;
  website?: string;
  usNewsRank?: number;
  qsRank?: number;
  acceptanceRate?: number;
  graduationRate?: number;
  retentionRate?: number;
  studentFacultyRatio?: number;
  tuition?: number;
  applicationFee?: number;
  averageAidPackage?: number;
  averageNetPrice?: number;
  roomAndBoard?: number;
  percentNeedMet?: number;
  testingPolicy?: TestingPolicyValue;
  testOptional?: boolean;
  hasEarlyDecision?: boolean;
  acceptsCommonApp?: boolean;
  acceptsCoalition?: boolean;
  feeWaiverAvailable?: boolean;
  needBlindInternational?: boolean | null;
  avgSalary?: number;
  salary6YrPostGrad?: number;
  metadata?: {
    requirements?: { toeflMin?: number; ieltsMin?: number };
    essayCount?: number;
  };
}

interface EditSchoolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  school: School | null;
  logoFillConfigured: boolean;
  onSave: (id: string, data: Record<string, unknown>) => void;
  onGenerateLogo: (schoolId: string) => void;
  isSaving: boolean;
  isGenerating: boolean;
}

interface FormState {
  logoUrl: string;
  website: string;
  usNewsRank: string;
  qsRank: string;
  acceptanceRate: string;
  graduationRate: string;
  retentionRate: string;
  studentFacultyRatio: string;
  tuition: string;
  applicationFee: string;
  averageAidPackage: string;
  averageNetPrice: string;
  roomAndBoard: string;
  percentNeedMet: string;
  testingPolicy: TestingPolicyValue;
  hasEarlyDecision: boolean;
  acceptsCommonApp: boolean;
  acceptsCoalition: boolean;
  feeWaiverAvailable: boolean;
  // tri-state: null = unreviewed (clears DB column), true/false = verified
  needBlindInternational: boolean | null;
  avgSalary: string;
  salary6YrPostGrad: string;
  toeflMin: string;
  ieltsMin: string;
  essayCount: string;
}

function schoolToForm(school: School | null): FormState {
  const testingPolicy = resolveSchoolTestingPolicyValue({
    testingPolicy: school?.testingPolicy,
    testOptional: school?.testOptional,
  });

  return {
    logoUrl: school?.logoUrl ?? '',
    website: school?.website ?? '',
    usNewsRank: school?.usNewsRank?.toString() ?? '',
    qsRank: school?.qsRank?.toString() ?? '',
    acceptanceRate: school?.acceptanceRate?.toString() ?? '',
    graduationRate: school?.graduationRate?.toString() ?? '',
    retentionRate: school?.retentionRate?.toString() ?? '',
    studentFacultyRatio: school?.studentFacultyRatio?.toString() ?? '',
    tuition: school?.tuition?.toString() ?? '',
    applicationFee: school?.applicationFee?.toString() ?? '',
    averageAidPackage: school?.averageAidPackage?.toString() ?? '',
    averageNetPrice: school?.averageNetPrice?.toString() ?? '',
    roomAndBoard: school?.roomAndBoard?.toString() ?? '',
    percentNeedMet: school?.percentNeedMet?.toString() ?? '',
    testingPolicy,
    hasEarlyDecision: school?.hasEarlyDecision ?? false,
    acceptsCommonApp: school?.acceptsCommonApp ?? false,
    acceptsCoalition: school?.acceptsCoalition ?? false,
    feeWaiverAvailable: school?.feeWaiverAvailable ?? false,
    // Preserve `null` (unreviewed). Don't collapse to false — that would
    // silently re-record "verified need-aware" for un-reviewed schools.
    needBlindInternational: school?.needBlindInternational ?? null,
    avgSalary: school?.avgSalary?.toString() ?? '',
    salary6YrPostGrad: school?.salary6YrPostGrad?.toString() ?? '',
    toeflMin: school?.metadata?.requirements?.toeflMin?.toString() ?? '',
    ieltsMin: school?.metadata?.requirements?.ieltsMin?.toString() ?? '',
    essayCount: school?.metadata?.essayCount?.toString() ?? '',
  };
}

function NumberInput({
  id,
  label,
  value,
  onChange,
  suffix,
  prefix,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  prefix?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-muted-foreground text-sm">{prefix}</span>}
        <Input
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
        {suffix && <span className="text-muted-foreground text-sm">{suffix}</span>}
      </div>
    </div>
  );
}

function BooleanField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="cursor-pointer">
        {label}
      </Label>
    </div>
  );
}

export function EditSchoolDialog({
  open,
  onOpenChange,
  school,
  logoFillConfigured,
  onSave,
  onGenerateLogo,
  isSaving,
  isGenerating,
}: EditSchoolDialogProps) {
  const t = useTranslations('admin');
  const testingPolicyT = useTranslations('applicationAnalysis.policy.testing');
  const locale = useLocale();

  const [form, setForm] = useState<FormState>(schoolToForm(null));
  const [previewFailed, setPreviewFailed] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && school) {
      setForm(schoolToForm(school));
      setPreviewFailed(false);
    }
    onOpenChange(nextOpen);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isValidUrl = (s: string) => {
    if (!s.trim()) return true;
    try {
      new URL(s);
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = () => {
    if (!school) return;
    const payload: Record<string, unknown> = {};

    // String fields
    const strDiff = (key: 'logoUrl' | 'website') => {
      const orig = school[key] ?? '';
      if (form[key] !== orig) payload[key] = form[key].trim() || null;
    };
    strDiff('logoUrl');
    strDiff('website');

    // Number fields
    const numDiff = (formKey: keyof FormState, schoolKey: keyof School) => {
      const formVal = form[formKey] as string;
      const origVal = school[schoolKey];
      const parsed = formVal.trim() === '' ? null : Number(formVal);
      if (parsed !== (origVal ?? null)) payload[schoolKey] = parsed;
    };
    numDiff('usNewsRank', 'usNewsRank');
    numDiff('qsRank', 'qsRank');
    numDiff('acceptanceRate', 'acceptanceRate');
    numDiff('graduationRate', 'graduationRate');
    numDiff('retentionRate', 'retentionRate');
    numDiff('studentFacultyRatio', 'studentFacultyRatio');
    numDiff('tuition', 'tuition');
    numDiff('applicationFee', 'applicationFee');
    numDiff('averageAidPackage', 'averageAidPackage');
    numDiff('averageNetPrice', 'averageNetPrice');
    numDiff('roomAndBoard', 'roomAndBoard');
    numDiff('percentNeedMet', 'percentNeedMet');
    numDiff('avgSalary', 'avgSalary');
    numDiff('salary6YrPostGrad', 'salary6YrPostGrad');

    // Metadata fields (sent as top-level DTO fields, backend merges into metadata JSON)
    const metaNumDiff = (
      formKey: keyof FormState,
      payloadKey: string,
      origVal: number | undefined
    ) => {
      const formVal = form[formKey] as string;
      const parsed = formVal.trim() === '' ? null : Number(formVal);
      if (parsed !== (origVal ?? null)) payload[payloadKey] = parsed;
    };
    metaNumDiff('toeflMin', 'toeflMin', school.metadata?.requirements?.toeflMin);
    metaNumDiff('ieltsMin', 'ieltsMin', school.metadata?.requirements?.ieltsMin);
    metaNumDiff('essayCount', 'essayCount', school.metadata?.essayCount);

    // Boolean fields — these default to false in the schema, so missing
    // means "false" for diffing purposes.
    const boolDiff = (key: keyof FormState & keyof School) => {
      const orig = school[key] ?? false;
      if (form[key] !== orig) payload[key] = form[key];
    };
    boolDiff('hasEarlyDecision');
    boolDiff('acceptsCommonApp');
    boolDiff('acceptsCoalition');
    boolDiff('feeWaiverAvailable');

    // needBlindInternational is tri-state (Boolean?). Send explicit null when
    // the admin sets the field back to "unreviewed" — the DTO accepts null
    // and the bulk-update service clears the column.
    {
      const orig = school.needBlindInternational ?? null;
      if (form.needBlindInternational !== orig) {
        payload.needBlindInternational = form.needBlindInternational;
      }
    }

    const originalTestingPolicy = resolveSchoolTestingPolicyValue({
      testingPolicy: school.testingPolicy,
      testOptional: school.testOptional,
    });
    if (form.testingPolicy !== originalTestingPolicy) {
      payload.testingPolicy = form.testingPolicy;
      payload.testOptional = toLegacyTestOptionalFlag({
        testingPolicy: form.testingPolicy,
      });
    }

    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }
    onSave(school.id, payload);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('schools.editSchool')}</DialogTitle>
          <DialogDescription>
            {school ? getSchoolName(school, locale) : t('schools.editSchoolDesc')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">{t('schools.tabs.basic')}</TabsTrigger>
            <TabsTrigger value="rankings">{t('schools.tabs.rankings')}</TabsTrigger>
            <TabsTrigger value="financial">{t('schools.tabs.financial')}</TabsTrigger>
            <TabsTrigger value="application">{t('schools.tabs.application')}</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-4 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label htmlFor="edit-logoUrl">{t('schools.logoUrl')}</Label>
                <div className="flex items-center gap-1">
                  {form.logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => {
                        setField('logoUrl', '');
                        setPreviewFailed(false);
                      }}
                    >
                      {t('schools.clearLogo')}
                    </Button>
                  )}
                  {school?.website && logoFillConfigured && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      disabled={isGenerating}
                      onClick={() => school && onGenerateLogo(school.id)}
                    >
                      {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      {t('schools.generateFromDomain')}
                    </Button>
                  )}
                </div>
              </div>
              <Input
                id="edit-logoUrl"
                placeholder={t('schools.logoUrlPlaceholder')}
                value={form.logoUrl}
                onChange={(e) => {
                  setField('logoUrl', e.target.value);
                  setPreviewFailed(false);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('schools.logoPreview')}</Label>
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                {form.logoUrl && !previewFailed ? (
                  <Image
                    src={form.logoUrl}
                    alt=""
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    unoptimized
                    onError={() => setPreviewFailed(true)}
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-website">{t('schools.website')}</Label>
              <Input
                id="edit-website"
                placeholder="https://www.example.edu"
                value={form.website}
                onChange={(e) => setField('website', e.target.value)}
              />
            </div>
          </TabsContent>

          {/* Rankings & Academics Tab */}
          <TabsContent value="rankings" className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <NumberInput
                id="edit-usNewsRank"
                label={t('schools.editDialog.usNewsRank')}
                value={form.usNewsRank}
                onChange={(v) => setField('usNewsRank', v)}
                prefix="#"
              />
              <NumberInput
                id="edit-qsRank"
                label={t('schools.editDialog.qsRank')}
                value={form.qsRank}
                onChange={(v) => setField('qsRank', v)}
                prefix="#"
              />
              <NumberInput
                id="edit-acceptanceRate"
                label={t('schools.acceptanceRate')}
                value={form.acceptanceRate}
                onChange={(v) => setField('acceptanceRate', v)}
                suffix="%"
              />
              <NumberInput
                id="edit-graduationRate"
                label={t('schools.graduationRate')}
                value={form.graduationRate}
                onChange={(v) => setField('graduationRate', v)}
                suffix="%"
              />
              <NumberInput
                id="edit-retentionRate"
                label={t('schools.retentionRate')}
                value={form.retentionRate}
                onChange={(v) => setField('retentionRate', v)}
                suffix="%"
              />
              <NumberInput
                id="edit-studentFacultyRatio"
                label={t('schools.studentFacultyRatio')}
                value={form.studentFacultyRatio}
                onChange={(v) => setField('studentFacultyRatio', v)}
                suffix=":1"
              />
            </div>
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <NumberInput
                id="edit-tuition"
                label={t('schools.tuition')}
                value={form.tuition}
                onChange={(v) => setField('tuition', v)}
                prefix="$"
              />
              <NumberInput
                id="edit-applicationFee"
                label={t('schools.applicationFee')}
                value={form.applicationFee}
                onChange={(v) => setField('applicationFee', v)}
                prefix="$"
              />
              <NumberInput
                id="edit-averageAidPackage"
                label={t('schools.averageAidPackage')}
                value={form.averageAidPackage}
                onChange={(v) => setField('averageAidPackage', v)}
                prefix="$"
              />
              <NumberInput
                id="edit-averageNetPrice"
                label={t('schools.averageNetPrice')}
                value={form.averageNetPrice}
                onChange={(v) => setField('averageNetPrice', v)}
                prefix="$"
              />
              <NumberInput
                id="edit-roomAndBoard"
                label={t('schools.roomAndBoard')}
                value={form.roomAndBoard}
                onChange={(v) => setField('roomAndBoard', v)}
                prefix="$"
              />
              <NumberInput
                id="edit-percentNeedMet"
                label={t('schools.percentNeedMet')}
                value={form.percentNeedMet}
                onChange={(v) => setField('percentNeedMet', v)}
                suffix="%"
              />
              <NumberInput
                id="edit-avgSalary"
                label={t('schools.avgSalary')}
                value={form.avgSalary}
                onChange={(v) => setField('avgSalary', v)}
                prefix="$"
              />
              <NumberInput
                id="edit-salary6YrPostGrad"
                label={t('schools.salary6YrPostGrad')}
                value={form.salary6YrPostGrad}
                onChange={(v) => setField('salary6YrPostGrad', v)}
                prefix="$"
              />
            </div>
          </TabsContent>

          {/* Application Tab */}
          <TabsContent value="application" className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="edit-testingPolicy">{t('schools.editDialog.testingPolicy')}</Label>
                <Select
                  value={form.testingPolicy}
                  onValueChange={(value) => setField('testingPolicy', value as TestingPolicyValue)}
                >
                  <SelectTrigger id="edit-testingPolicy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REQUIRED">{testingPolicyT('REQUIRED')}</SelectItem>
                    <SelectItem value="OPTIONAL">{testingPolicyT('OPTIONAL')}</SelectItem>
                    <SelectItem value="BLIND">{testingPolicyT('BLIND')}</SelectItem>
                    <SelectItem value="UNKNOWN">{testingPolicyT('UNKNOWN')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <BooleanField
                id="edit-hasEarlyDecision"
                label={t('schools.editDialog.earlyDecision')}
                checked={form.hasEarlyDecision}
                onChange={(v) => setField('hasEarlyDecision', v)}
              />
              <BooleanField
                id="edit-acceptsCommonApp"
                label={t('schools.editDialog.commonApp')}
                checked={form.acceptsCommonApp}
                onChange={(v) => setField('acceptsCommonApp', v)}
              />
              <BooleanField
                id="edit-acceptsCoalition"
                label={t('schools.editDialog.coalitionApp')}
                checked={form.acceptsCoalition}
                onChange={(v) => setField('acceptsCoalition', v)}
              />
              <BooleanField
                id="edit-feeWaiverAvailable"
                label={t('schools.editDialog.feeWaiver')}
                checked={form.feeWaiverAvailable}
                onChange={(v) => setField('feeWaiverAvailable', v)}
              />
              <div className="flex flex-col gap-1">
                <Label htmlFor="edit-needBlindInternational" className="text-sm">
                  {t('schools.editDialog.needBlindIntl')}
                </Label>
                <Select
                  // tri-state: encode null as the sentinel string "unreviewed"
                  // because Radix Select cannot hold a literal null value.
                  value={
                    form.needBlindInternational === true
                      ? 'true'
                      : form.needBlindInternational === false
                        ? 'false'
                        : 'unreviewed'
                  }
                  onValueChange={(v) =>
                    setField(
                      'needBlindInternational',
                      v === 'true' ? true : v === 'false' ? false : null
                    )
                  }
                >
                  <SelectTrigger id="edit-needBlindInternational" size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unreviewed">
                      {t('schools.editDialog.needBlindIntlOptions.unreviewed')}
                    </SelectItem>
                    <SelectItem value="true">
                      {t('schools.editDialog.needBlindIntlOptions.needBlind')}
                    </SelectItem>
                    <SelectItem value="false">
                      {t('schools.editDialog.needBlindIntlOptions.needAware')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <NumberInput
                id="edit-toeflMin"
                label={t('schools.toeflMin')}
                value={form.toeflMin}
                onChange={(v) => setField('toeflMin', v)}
              />
              <NumberInput
                id="edit-ieltsMin"
                label={t('schools.ieltsMin')}
                value={form.ieltsMin}
                onChange={(v) => setField('ieltsMin', v)}
              />
              <NumberInput
                id="edit-essayCount"
                label={t('schools.essayCount')}
                value={form.essayCount}
                onChange={(v) => setField('essayCount', v)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={isSaving || (form.logoUrl.trim() !== '' && !isValidUrl(form.logoUrl.trim()))}
            onClick={handleSave}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
