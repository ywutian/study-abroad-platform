'use client';

import { useCallback, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  ResumeSettings,
  ResumeColorSettings,
  ResumeFontSizeSettings,
  ResumeSpacingSettings,
  ResumeDecorationSettings,
} from '@study-abroad/shared';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ColorPickerField } from './color-picker-field';
import { resolveTemplate } from './pdf/templates';

// Available fonts — only those registered with @react-pdf
const AVAILABLE_FONTS = [
  { value: 'Helvetica', label: 'Helvetica (ATS Safe)' },
  { value: 'Times-Roman', label: 'Times New Roman' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Noto Sans SC', label: 'Noto Sans SC (中文)' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro' },
  { value: 'Merriweather', label: 'Merriweather' },
];

interface CustomizePanelProps {
  settings: ResumeSettings;
  onChange: (settings: ResumeSettings) => void;
  onReset: () => void;
  templateId: string;
}

export function CustomizePanel({ settings, onChange, onReset, templateId }: CustomizePanelProps) {
  const t = useTranslations('resume.customize');

  // Get current template's layout and default theme for showing placeholders
  const { layout, theme: defaultTheme } = useMemo(() => resolveTemplate(templateId), [templateId]);

  const isSidebar = layout === 'sidebar-left' || layout === 'sidebar-right';
  const isBanner = layout === 'header-banner-single' || layout === 'header-banner-columns';

  // ─── Color Handlers ───
  const handleColorChange = useCallback(
    (field: keyof ResumeColorSettings, value: string) => {
      onChange({ ...settings, colors: { ...settings.colors, [field]: value } });
    },
    [settings, onChange]
  );

  const handleColorClear = useCallback(
    (field: keyof ResumeColorSettings) => {
      const { [field]: _, ...rest } = settings.colors || {};
      const hasKeys = Object.keys(rest).length > 0;
      onChange({ ...settings, colors: hasKeys ? rest : undefined });
    },
    [settings, onChange]
  );

  // ─── Font Handlers ───
  const handleFontChange = useCallback(
    (field: 'heading' | 'body', value: string) => {
      onChange({ ...settings, fonts: { ...settings.fonts, [field]: value } });
    },
    [settings, onChange]
  );

  // ─── Font Size Handlers ───
  const handleFontSizeChange = useCallback(
    (field: keyof ResumeFontSizeSettings, value: number) => {
      onChange({ ...settings, fontSize: { ...settings.fontSize, [field]: value } });
    },
    [settings, onChange]
  );

  // ─── Spacing Handlers ───
  const handleSpacingChange = useCallback(
    (field: keyof ResumeSpacingSettings, value: number) => {
      onChange({ ...settings, spacing: { ...settings.spacing, [field]: value } });
    },
    [settings, onChange]
  );

  // ─── Decoration Handlers ───
  const handleDecorationChange = useCallback(
    (field: keyof ResumeDecorationSettings, value: string) => {
      onChange({ ...settings, decorations: { ...settings.decorations, [field]: value } });
    },
    [settings, onChange]
  );

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t('title')}</h3>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onReset}>
          <RotateCcw className="mr-1 h-3 w-3" />
          {t('reset')}
        </Button>
      </div>

      <Separator />

      <Accordion type="multiple" defaultValue={['colors']} className="space-y-1">
        {/* ─── Colors ─── */}
        <AccordionItem value="colors">
          <AccordionTrigger className="py-2 text-sm">{t('colors.title')}</AccordionTrigger>
          <AccordionContent className="space-y-2.5 pb-3">
            <ColorPickerField
              label={t('colors.primary')}
              value={settings.colors?.primary}
              defaultValue={defaultTheme.primary}
              onChange={(v) => handleColorChange('primary', v)}
              onClear={() => handleColorClear('primary')}
            />
            <ColorPickerField
              label={t('colors.text')}
              value={settings.colors?.text}
              defaultValue={defaultTheme.text}
              onChange={(v) => handleColorChange('text', v)}
              onClear={() => handleColorClear('text')}
            />
            <ColorPickerField
              label={t('colors.textLight')}
              value={settings.colors?.textLight}
              defaultValue={defaultTheme.textLight}
              onChange={(v) => handleColorChange('textLight', v)}
              onClear={() => handleColorClear('textLight')}
            />
            <ColorPickerField
              label={t('colors.background')}
              value={settings.colors?.background}
              defaultValue={defaultTheme.background}
              onChange={(v) => handleColorChange('background', v)}
              onClear={() => handleColorClear('background')}
            />
            <ColorPickerField
              label={t('colors.border')}
              value={settings.colors?.border}
              defaultValue={defaultTheme.border}
              onChange={(v) => handleColorChange('border', v)}
              onClear={() => handleColorClear('border')}
            />
            {isSidebar && (
              <>
                <Separator className="my-1.5" />
                <ColorPickerField
                  label={t('colors.sidebarBg')}
                  value={settings.colors?.sidebarBg}
                  defaultValue={defaultTheme.sidebarBg}
                  onChange={(v) => handleColorChange('sidebarBg', v)}
                  onClear={() => handleColorClear('sidebarBg')}
                />
                <ColorPickerField
                  label={t('colors.sidebarText')}
                  value={settings.colors?.sidebarText}
                  defaultValue={defaultTheme.sidebarText}
                  onChange={(v) => handleColorChange('sidebarText', v)}
                  onClear={() => handleColorClear('sidebarText')}
                />
              </>
            )}
            {isBanner && (
              <>
                <Separator className="my-1.5" />
                <ColorPickerField
                  label={t('colors.headerBg')}
                  value={settings.colors?.headerBg}
                  defaultValue={defaultTheme.headerBg}
                  onChange={(v) => handleColorChange('headerBg', v)}
                  onClear={() => handleColorClear('headerBg')}
                />
                <ColorPickerField
                  label={t('colors.headerText')}
                  value={settings.colors?.headerText}
                  defaultValue={defaultTheme.headerText}
                  onChange={(v) => handleColorChange('headerText', v)}
                  onClear={() => handleColorClear('headerText')}
                />
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ─── Fonts ─── */}
        <AccordionItem value="fonts">
          <AccordionTrigger className="py-2 text-sm">{t('fonts.title')}</AccordionTrigger>
          <AccordionContent className="space-y-3 pb-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('fonts.heading')}</Label>
              <Select
                value={settings.fonts?.heading || defaultTheme.fontFamily.heading}
                onValueChange={(v) => handleFontChange('heading', v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_FONTS.map((f) => (
                    <SelectItem key={f.value} value={f.value} className="text-xs">
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('fonts.body')}</Label>
              <Select
                value={settings.fonts?.body || defaultTheme.fontFamily.body}
                onValueChange={(v) => handleFontChange('body', v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_FONTS.map((f) => (
                    <SelectItem key={f.value} value={f.value} className="text-xs">
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ─── Font Sizes ─── */}
        <AccordionItem value="fontSize">
          <AccordionTrigger className="py-2 text-sm">{t('fontSize.title')}</AccordionTrigger>
          <AccordionContent className="space-y-3 pb-3">
            <SliderField
              label={t('fontSize.name')}
              value={settings.fontSize?.name ?? defaultTheme.fontSize.name}
              min={16}
              max={32}
              step={1}
              onChange={(v) => handleFontSizeChange('name', v)}
            />
            <SliderField
              label={t('fontSize.sectionTitle')}
              value={settings.fontSize?.sectionTitle ?? defaultTheme.fontSize.sectionTitle}
              min={8}
              max={18}
              step={0.5}
              onChange={(v) => handleFontSizeChange('sectionTitle', v)}
            />
            <SliderField
              label={t('fontSize.body')}
              value={settings.fontSize?.body ?? defaultTheme.fontSize.body}
              min={8}
              max={14}
              step={0.5}
              onChange={(v) => handleFontSizeChange('body', v)}
            />
            <SliderField
              label={t('fontSize.small')}
              value={settings.fontSize?.small ?? defaultTheme.fontSize.small}
              min={7}
              max={12}
              step={0.5}
              onChange={(v) => handleFontSizeChange('small', v)}
            />
          </AccordionContent>
        </AccordionItem>

        {/* ─── Spacing ─── */}
        <AccordionItem value="spacing">
          <AccordionTrigger className="py-2 text-sm">{t('spacing.title')}</AccordionTrigger>
          <AccordionContent className="space-y-3 pb-3">
            <SliderField
              label={t('spacing.pageMarginX')}
              value={settings.spacing?.pageMarginX ?? defaultTheme.spacing.page.x}
              min={18}
              max={72}
              step={2}
              unit="pt"
              onChange={(v) => handleSpacingChange('pageMarginX', v)}
            />
            <SliderField
              label={t('spacing.pageMarginY')}
              value={settings.spacing?.pageMarginY ?? defaultTheme.spacing.page.y}
              min={18}
              max={72}
              step={2}
              unit="pt"
              onChange={(v) => handleSpacingChange('pageMarginY', v)}
            />
            <SliderField
              label={t('spacing.sectionGap')}
              value={settings.spacing?.sectionGap ?? defaultTheme.spacing.sectionGap}
              min={4}
              max={24}
              step={1}
              unit="pt"
              onChange={(v) => handleSpacingChange('sectionGap', v)}
            />
            <SliderField
              label={t('spacing.itemGap')}
              value={settings.spacing?.itemGap ?? defaultTheme.spacing.itemGap}
              min={2}
              max={12}
              step={1}
              unit="pt"
              onChange={(v) => handleSpacingChange('itemGap', v)}
            />
            <SliderField
              label={t('spacing.lineHeight')}
              value={settings.spacing?.lineHeight ?? defaultTheme.spacing.lineHeight}
              min={1}
              max={2}
              step={0.05}
              unit="x"
              onChange={(v) => handleSpacingChange('lineHeight', v)}
            />
          </AccordionContent>
        </AccordionItem>

        {/* ─── Decorations / Style ─── */}
        <AccordionItem value="decorations">
          <AccordionTrigger className="py-2 text-sm">{t('decorations.title')}</AccordionTrigger>
          <AccordionContent className="space-y-3 pb-3">
            <SelectField
              label={t('decorations.sectionDivider')}
              value={
                settings.decorations?.sectionDivider ?? defaultTheme.decorations.sectionDivider
              }
              options={[
                { value: 'line', label: t('decorations.options.line') },
                { value: 'double-line', label: t('decorations.options.doubleLine') },
                { value: 'dots', label: t('decorations.options.dots') },
                { value: 'none', label: t('decorations.options.none') },
              ]}
              onChange={(v) => handleDecorationChange('sectionDivider', v)}
            />
            <SelectField
              label={t('decorations.headingStyle')}
              value={settings.decorations?.headingStyle ?? defaultTheme.decorations.headingStyle}
              options={[
                { value: 'underline', label: t('decorations.options.underline') },
                { value: 'background', label: t('decorations.options.background') },
                { value: 'border-left', label: t('decorations.options.borderLeft') },
                { value: 'uppercase', label: t('decorations.options.uppercase') },
                { value: 'plain', label: t('decorations.options.plain') },
              ]}
              onChange={(v) => handleDecorationChange('headingStyle', v)}
            />
            <SelectField
              label={t('decorations.bulletStyle')}
              value={settings.decorations?.bulletStyle ?? defaultTheme.decorations.bulletStyle}
              options={[
                { value: 'disc', label: t('decorations.options.disc') },
                { value: 'dash', label: t('decorations.options.dash') },
                { value: 'arrow', label: t('decorations.options.arrow') },
                { value: 'square', label: t('decorations.options.square') },
              ]}
              onChange={(v) => handleDecorationChange('bulletStyle', v)}
            />
            <SelectField
              label={t('decorations.pageSize')}
              value={settings.decorations?.pageSize ?? defaultTheme.decorations.pageSize}
              options={[
                { value: 'LETTER', label: 'US Letter (8.5" x 11")' },
                { value: 'A4', label: 'A4 (210mm x 297mm)' },
              ]}
              onChange={(v) => handleDecorationChange('pageSize', v)}
            />
            <SelectField
              label={t('decorations.dateFormat')}
              value={settings.decorations?.dateFormat ?? defaultTheme.decorations.dateFormat}
              options={[
                { value: 'MMM YYYY', label: 'Jan 2024' },
                { value: 'MM/YYYY', label: '01/2024' },
                { value: 'YYYY', label: '2024' },
              ]}
              onChange={(v) => handleDecorationChange('dateFormat', v)}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// ─── Sub-components ───

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}

function SliderField({ label, value, min, max, step, unit, onChange }: SliderFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            className="h-6 w-14 text-center font-mono text-xs"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (!isNaN(n) && n >= min && n <= max) onChange(n);
            }}
          />
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="py-1"
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
