'use client';

import { useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Upload,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  FileSpreadsheet,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

type ImportType = 'cases' | 'essay-prompts' | 'schools';
type Step = 1 | 2 | 3 | 4 | 5;

interface ValidationRow {
  row: number;
  status: 'valid' | 'warning' | 'error';
  issues: { field: string; message: string }[];
  data: Record<string, string>;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; school: string; message: string }>;
}

const STEPS: { key: Step; i18nKey: string }[] = [
  { key: 1, i18nKey: 'step1' },
  { key: 2, i18nKey: 'step2' },
  { key: 3, i18nKey: 'step3' },
  { key: 4, i18nKey: 'step4' },
  { key: 5, i18nKey: 'step5' },
];

const CASE_REQUIRED_FIELDS = ['school', 'year', 'result'];
const ESSAY_REQUIRED_FIELDS = ['school', 'year', 'prompt'];

interface FieldSpec {
  name: string;
  required: boolean;
  format: string;
  validValues?: string;
  example: string;
}

const CASE_FIELD_SPECS: FieldSpec[] = [
  { name: 'school', required: true, format: 'String', example: 'MIT' },
  { name: 'year', required: true, format: 'Integer (2000–2100)', example: '2025' },
  {
    name: 'result',
    required: true,
    format: 'Enum',
    validValues: 'ADMITTED / REJECTED / WAITLISTED / DEFERRED',
    example: 'ADMITTED',
  },
  {
    name: 'round',
    required: false,
    format: 'Enum',
    validValues: 'ED / ED2 / EA / REA / RD / ROLLING',
    example: 'RD',
  },
  { name: 'major', required: false, format: 'String', example: 'Computer Science' },
  { name: 'gpa', required: false, format: 'Range (X.X-X.X)', example: '3.8-4.0' },
  { name: 'sat', required: false, format: 'Range (XXXX-XXXX)', example: '1500-1550' },
  { name: 'act', required: false, format: 'Range (XX-XX)', example: '34-36' },
  { name: 'toefl', required: false, format: 'Range (XXX-XXX)', example: '110-115' },
  { name: 'tags', required: false, format: 'Semicolon-separated', example: 'research;olympiad' },
];

const ESSAY_FIELD_SPECS: FieldSpec[] = [
  { name: 'school', required: true, format: 'String', example: 'Stanford' },
  { name: 'year', required: true, format: 'Integer (2020–2030)', example: '2025' },
  {
    name: 'type',
    required: true,
    format: 'Enum',
    validValues:
      'SUPPLEMENTAL / SHORT_ANSWER / PERSONAL_STATEMENT / WHY_SCHOOL / ACTIVITY / OPTIONAL / OTHER',
    example: 'SUPPLEMENTAL',
  },
  {
    name: 'prompt',
    required: true,
    format: 'String (max 5000)',
    example: 'What matters to you and why?',
  },
  { name: 'promptZh', required: false, format: 'String (max 5000)', example: '什么对你重要？' },
  { name: 'wordLimit', required: false, format: 'Integer (0–10000)', example: '250' },
  {
    name: 'isRequired',
    required: false,
    format: 'Boolean',
    validValues: 'true / false',
    example: 'true',
  },
  { name: 'sourceUrl', required: false, format: 'URL', example: 'https://...' },
];

const CASE_TEMPLATE = `school,major,year,round,result,gpa,sat,act,toefl,tags
MIT,Computer Science,2025,RD,ADMITTED,3.9-4.0,1550-1600,,115,research;olympiad
Stanford,Economics,2025,ED,REJECTED,3.8-3.9,1500-1550,,,business`;

const ESSAY_TEMPLATE = `school,year,type,prompt,promptZh,wordLimit,isRequired,sourceUrl
Stanford,2025,SUPPLEMENTAL,"What matters to you and why?","什么对你重要，为什么？",250,true,`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BulkImportTab() {
  const t = useTranslations('admin.dataReview.import');
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [importType, setImportType] = useState<ImportType>('cases');
  const [fileName, setFileName] = useState('');
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Step 1: Upload
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setRawData(results.data as Record<string, string>[]);
          setStep(2);
          // Auto-validate
          validateData(results.data as Record<string, string>[]);
        },
        error: (err) => {
          toast.error(err.message);
        },
      });
    },
    [importType]
  );

  // Step 2: Validate
  const validateData = (data: Record<string, string>[]) => {
    const required = importType === 'cases' ? CASE_REQUIRED_FIELDS : ESSAY_REQUIRED_FIELDS;
    const results: ValidationRow[] = data.map((row, i) => {
      const issues: { field: string; message: string }[] = [];

      // Required fields
      for (const field of required) {
        if (!row[field]?.trim()) {
          issues.push({ field, message: `Missing required field: ${field}` });
        }
      }

      // Type-specific validations
      if (importType === 'cases') {
        if (
          row.year &&
          (isNaN(Number(row.year)) || Number(row.year) < 2000 || Number(row.year) > 2030)
        ) {
          issues.push({ field: 'year', message: 'Invalid year' });
        }
        if (row.gpa && !/^\d+\.?\d*(-\d+\.?\d*)?$/.test(row.gpa)) {
          issues.push({ field: 'gpa', message: 'Invalid GPA format (expected: 3.8-4.0)' });
        }
      } else {
        // Essay prompt validations
        const VALID_ESSAY_TYPES = [
          'SUPPLEMENTAL',
          'SHORT_ANSWER',
          'PERSONAL_STATEMENT',
          'WHY_SCHOOL',
          'ACTIVITY',
          'OPTIONAL',
          'OTHER',
          'COMMON_APP',
          'UC',
          'MAIN',
        ];
        if (row.type && !VALID_ESSAY_TYPES.includes(row.type.trim().toUpperCase())) {
          issues.push({
            field: 'type',
            message: `Invalid essay type. Expected: ${VALID_ESSAY_TYPES.join(', ')}`,
          });
        }
        if (
          row.year &&
          (isNaN(Number(row.year)) || Number(row.year) < 2020 || Number(row.year) > 2030)
        ) {
          issues.push({ field: 'year', message: 'Invalid year (2020-2030)' });
        }
        if (row.prompt && row.prompt.length > 5000) {
          issues.push({ field: 'prompt', message: `Prompt too long (${row.prompt.length}/5000)` });
        }
        if (
          row.wordLimit &&
          (isNaN(Number(row.wordLimit)) ||
            Number(row.wordLimit) < 0 ||
            Number(row.wordLimit) > 10000)
        ) {
          issues.push({ field: 'wordLimit', message: 'Invalid word limit (0-10000)' });
        }
      }

      const hasError = issues.some((i) => required.includes(i.field));
      return {
        row: i + 1,
        status: issues.length === 0 ? 'valid' : hasError ? 'error' : 'warning',
        issues,
        data: row,
      };
    });

    setValidationResults(results);
  };

  const validCount = validationResults.filter((r) => r.status === 'valid').length;
  const warningCount = validationResults.filter((r) => r.status === 'warning').length;
  const errorCount = validationResults.filter((r) => r.status === 'error').length;

  // Step 4: Import
  const importMutation = useMutation({
    mutationFn: async () => {
      const validRows = validationResults.filter((r) => r.status !== 'error').map((r) => r.data);

      if (importType === 'cases') {
        const items = validRows.map((row) => ({
          school: row.school || '',
          major: row.major || undefined,
          year: parseInt(row.year) || new Date().getFullYear(),
          round: row.round || undefined,
          result: row.result || 'ADMITTED',
          gpa: row.gpa || undefined,
          sat: row.sat || undefined,
          act: row.act || undefined,
          toefl: row.toefl || undefined,
          tags: row.tags || undefined,
        }));
        return apiClient.post<ImportResult>(adminRoutes.casesBatchImport(), {
          items,
          visibility: 'ANONYMOUS',
        });
      } else {
        const items = validRows.map((row) => ({
          school: row.school || '',
          year: parseInt(row.year) || new Date().getFullYear(),
          type: row.type || 'OTHER',
          prompt: row.prompt || '',
          promptZh: row.promptZh || undefined,
          wordLimit: row.wordLimit ? parseInt(row.wordLimit) : undefined,
          isRequired: row.isRequired !== 'false',
          sourceUrl: row.sourceUrl || undefined,
        }));
        return apiClient.post<ImportResult>(adminRoutes.essayPromptsBatchImport(), { items });
      }
    },
    onSuccess: (data) => {
      setImportResult(data);
      setStep(5);
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      queryClient.invalidateQueries({ queryKey: ['reviewStats'] });
      queryClient.invalidateQueries({ queryKey: ['importBatches'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });

  const handleStartImport = () => {
    setStep(4);
    importMutation.mutate();
  };

  const resetWizard = () => {
    setStep(1);
    setFileName('');
    setRawData([]);
    setValidationResults([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const template = importType === 'cases' ? CASE_TEMPLATE : ESSAY_TEMPLATE;
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${importType}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl">
      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map(({ key, i18nKey }, idx) => (
          <div key={key} className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors',
                step >= key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {step > key ? <CheckCircle className="h-4 w-4" /> : key}
            </div>
            <span
              className={cn(
                'text-xs hidden sm:inline',
                step >= key ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {t(i18nKey)}
            </span>
            {idx < STEPS.length - 1 && (
              <div className={cn('w-6 h-px', step > key ? 'bg-primary' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={importType} onValueChange={(v) => setImportType(v as ImportType)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('importType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cases">{t('typeCases')}</SelectItem>
                <SelectItem value="essay-prompts">{t('typeEssays')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-3.5 w-3.5 mr-1" />
              {t('downloadTemplate')}
            </Button>
          </div>

          {/* Field format help */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <HelpCircle className="h-3.5 w-3.5" />
                {t('formatHelp')}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-2">
                <CardContent className="pt-4 pb-2">
                  <p className="text-xs text-muted-foreground mb-3">{t('formatHelpDesc')}</p>
                  <ScrollArea className="max-h-[280px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">{t('fieldName')}</TableHead>
                          <TableHead className="text-xs w-[70px]">{t('fieldRequired')}</TableHead>
                          <TableHead className="text-xs">{t('fieldFormat')}</TableHead>
                          <TableHead className="text-xs">{t('fieldValidValues')}</TableHead>
                          <TableHead className="text-xs">{t('fieldExample')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(importType === 'cases' ? CASE_FIELD_SPECS : ESSAY_FIELD_SPECS).map(
                          (spec) => (
                            <TableRow key={spec.name}>
                              <TableCell className="font-mono text-xs">{spec.name}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={spec.required ? 'default' : 'secondary'}
                                  className="text-[10px] px-1.5"
                                >
                                  {spec.required ? t('required') : t('optional')}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {spec.format}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                                {spec.validValues || '—'}
                              </TableCell>
                              <TableCell className="text-xs font-mono">{spec.example}</TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          <Card
            className="border-dashed cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <CardContent className="py-12 flex flex-col items-center gap-3">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">{t('uploadTitle')}</p>
                <p className="text-sm text-muted-foreground">{t('uploadDesc')}</p>
              </div>
              {fileName && (
                <Badge variant="secondary" className="gap-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  {fileName}
                </Badge>
              )}
            </CardContent>
          </Card>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Step 2: Validate */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {t('validRows')}: <strong>{validCount}</strong>
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              {t('warningRows')}: <strong>{warningCount}</strong>
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              {t('errorRows')}: <strong>{errorCount}</strong>
            </span>
          </div>

          {validationResults.some((r) => r.issues.length > 0) && (
            <ScrollArea className="max-h-[300px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t('rowNumber')}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>{t('field')}</TableHead>
                    <TableHead>{t('issue')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationResults
                    .filter((r) => r.issues.length > 0)
                    .flatMap((r) =>
                      r.issues.map((issue, idx) => (
                        <TableRow key={`${r.row}-${idx}`}>
                          {idx === 0 && (
                            <>
                              <TableCell rowSpan={r.issues.length} className="font-mono text-xs">
                                {r.row}
                              </TableCell>
                              <TableCell rowSpan={r.issues.length}>
                                {r.status === 'error' ? (
                                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                )}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-xs font-mono">{issue.field}</TableCell>
                          <TableCell className="text-xs">{issue.message}</TableCell>
                        </TableRow>
                      ))
                    )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={resetWizard}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t('step1')}
            </Button>
            <Button onClick={() => setStep(3)} disabled={validCount === 0}>
              {t('preview')}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {validCount}
                </p>
                <p className="text-xs text-muted-foreground">{t('autoApprove')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {warningCount}
                </p>
                <p className="text-xs text-muted-foreground">{t('needsReview')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{errorCount}</p>
                <p className="text-xs text-muted-foreground">{t('errorRows')}</p>
              </CardContent>
            </Card>
          </div>

          <p className="text-sm text-muted-foreground">
            {validCount + warningCount} / {validationResults.length} rows will be imported (
            {errorCount} skipped due to errors).
          </p>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t('step2')}
            </Button>
            <Button onClick={handleStartImport} disabled={validCount + warningCount === 0}>
              {t('step4')}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === 4 && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium">
            {t('importing', { current: 0, total: validCount + warningCount })}
          </p>
          <Progress value={importMutation.isPending ? 50 : 100} className="w-64" />
        </div>
      )}

      {/* Step 5: Results */}
      {step === 5 && importResult && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-lg font-semibold">{t('importSuccess')}</h3>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {importResult.imported}
                </p>
                <p className="text-xs text-muted-foreground">{t('imported')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {importResult.skipped}
                </p>
                <p className="text-xs text-muted-foreground">{t('skipped')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {importResult.errors.length}
                </p>
                <p className="text-xs text-muted-foreground">{t('errors')}</p>
              </CardContent>
            </Card>
          </div>

          {importResult.errors.length > 0 && (
            <ScrollArea className="max-h-[200px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('rowNumber')}</TableHead>
                    <TableHead>{t('table.school' as Parameters<typeof t>[0])}</TableHead>
                    <TableHead>{t('issue')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importResult.errors.map((err, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{err.row}</TableCell>
                      <TableCell className="text-xs">{err.school}</TableCell>
                      <TableCell className="text-xs text-red-600 dark:text-red-400">
                        {err.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={resetWizard}>
              {t('startNew')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
