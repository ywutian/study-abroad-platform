'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PenTool, Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';

const ESSAY_TYPES = [
  { value: 'COMMON_APP', label: 'Common App' },
  { value: 'UC', label: 'UC' },
  { value: 'SUPPLEMENTAL', label: 'Supplemental' },
  { value: 'WHY_SCHOOL', label: 'Why School' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'ACTIVITY', label: 'Activity' },
  { value: 'OPTIONAL', label: 'Optional' },
  { value: 'OTHER', label: 'Other' },
];

// PUBLIC removed 2026-08-04: it was rejected by `GET /cases` and accepted by
// `GET /cases/:id`, so choosing it made a case harder to find than ANONYMOUS.
// Retired for cases; the enum keeps the value for Profile.visibility.
const VISIBILITY_OPTIONS = [
  { value: 'ANONYMOUS', labelKey: 'anonymous' },
  { value: 'VERIFIED_ONLY', labelKey: 'verifiedOnly' },
];

interface PdfTextItem {
  str?: string;
}

interface PdfPage {
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
}

interface PdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
}

interface PdfJsModule {
  version: string;
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (data: ArrayBuffer) => { promise: Promise<PdfDocument> };
}

function isPdfJsModule(value: unknown): value is PdfJsModule {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;
  const workerOptions = candidate.GlobalWorkerOptions;

  return (
    typeof candidate.version === 'string' &&
    typeof candidate.getDocument === 'function' &&
    typeof workerOptions === 'object' &&
    workerOptions !== null &&
    'workerSrc' in workerOptions
  );
}

interface EssaySectionProps {
  includeEssay: boolean;
  setIncludeEssay: (v: boolean) => void;
  essayType: string;
  essayPrompt: string;
  essayContent: string;
  visibility: string;
  onFieldChange: (field: string, value: string) => void;
}

export function EssaySection({
  includeEssay,
  setIncludeEssay,
  essayType,
  essayPrompt,
  essayContent,
  visibility,
  onFieldChange,
}: EssaySectionProps) {
  const t = useTranslations('submitCase');
  const tc = useTranslations('common');
  const essayFileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processEssayFile = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      try {
        if (ext === 'txt') {
          const text = await file.text();
          onFieldChange('essayContent', text);
        } else if (ext === 'docx') {
          const mammoth = await import('mammoth');
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          onFieldChange('essayContent', result.value);
        } else if (ext === 'pdf') {
          const importedPdfJs: unknown = await import(
            /* webpackIgnore: true */ 'pdfjs-dist' as string
          );
          if (!isPdfJsModule(importedPdfJs)) {
            throw new Error('Unsupported PDF.js module shape');
          }
          const pdfjsLib = importedPdfJs;
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
          const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
          const pages: string[] = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);

            const content = await page.getTextContent();
            pages.push(content.items.map((item) => item.str ?? '').join(' '));
          }
          onFieldChange('essayContent', pages.join('\n\n'));
        } else {
          toast.error(tc('unsupportedFileFormat'));
        }
      } catch {
        toast.error(tc('failedToReadFile'));
      }
    },
    [onFieldChange, tc]
  );

  return (
    <div className="border-t pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PenTool className="h-4 w-4 text-primary" />
          <Label className="font-medium">{t('includeEssay')}</Label>
        </div>
        <Switch checked={includeEssay} onCheckedChange={setIncludeEssay} />
      </div>

      {includeEssay && (
        <div className="space-y-4 pl-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('essayTypeLabel')}</Label>
              <Select value={essayType} onValueChange={(v) => onFieldChange('essayType', v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('essayTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {ESSAY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('visibilityLabel')}</Label>
              <Select value={visibility} onValueChange={(v) => onFieldChange('visibility', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {t(`visibility.${v.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('essayPromptLabel')}</Label>
            <Textarea
              placeholder={t('essayPromptPlaceholder')}
              value={essayPrompt}
              onChange={(e) => onFieldChange('essayPrompt', e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('essayContentLabel')}</Label>
              <div className="flex items-center gap-2">
                <span className="text-2xs text-muted-foreground">.txt .docx .pdf</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => essayFileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t('importFromFile')}
                </Button>
              </div>
              <input
                ref={essayFileInputRef}
                type="file"
                accept=".txt,.docx,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processEssayFile(file);
                  e.target.value = '';
                }}
              />
            </div>
            <div
              className={`relative rounded-md transition-colors ${isDragging ? 'ring-2 ring-primary bg-primary/5' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) processEssayFile(file);
              }}
            >
              {isDragging && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-primary/10 border-2 border-dashed border-primary">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <FileText className="h-5 w-5" />
                    {t('dropEssayHere') || 'Drop your essay file here'}
                  </div>
                </div>
              )}
              <Textarea
                placeholder={t('essayContentPlaceholder')}
                value={essayContent}
                onChange={(e) => onFieldChange('essayContent', e.target.value)}
                rows={15}
                className="min-h-[300px] resize-y"
              />
            </div>
            {essayContent && (
              <div className="flex justify-end">
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {essayContent.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
