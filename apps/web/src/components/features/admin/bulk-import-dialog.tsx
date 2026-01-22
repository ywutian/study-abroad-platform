'use client';

import { useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

type ImportType = 'essay-prompts' | 'cases';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; school: string; message: string }>;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importType: ImportType;
}

const ESSAY_PROMPT_TEMPLATE = `school,year,type,prompt,promptZh,wordLimit,isRequired,sourceUrl
Stanford,2025,SUPPLEMENT,"What matters to you and why?","什么对你重要，为什么？",250,true,
MIT,2025,SHORT_ANSWER,"Tell us about something you do simply for the pleasure of it.","告诉我们一件你纯粹因为快乐而做的事情。",200,true,
Harvard,2025,SUPPLEMENT,"Harvard has long recognized the importance of enrolling a diverse student body.","哈佛长期以来一直认识到招收多元化学生群体的重要性。",500,false,`;

const CASE_TEMPLATE = `school,major,year,round,result,gpa,sat,act,toefl,tags,essayType,essayPrompt,essayContent
MIT,Computer Science,2025,RD,ADMITTED,3.9-4.0,1550-1600,,115,research;olympiad,COMMON_APP,"Some students have a background...","My essay content here..."
Stanford,Economics,2025,ED,REJECTED,3.8-3.9,1500-1550,,,business,,,
Harvard,Biology,2025,REA,WAITLISTED,3.9-4.0,1540-1580,,112,research;pre-med,,,`;

export function BulkImportDialog({ open, onOpenChange, importType }: BulkImportDialogProps) {
  const t = useTranslations('essayAdmin');
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [autoVerify, setAutoVerify] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const isEssayPrompt = importType === 'essay-prompts';
  const title = isEssayPrompt ? t('importPrompts') : t('importCases');

  const importMutation = useMutation({
    mutationFn: async (data: Record<string, string>[]) => {
      if (isEssayPrompt) {
        const items = data.map((row) => ({
          school: row.school || '',
          year: parseInt(row.year) || new Date().getFullYear(),
          type: row.type || 'OTHER',
          prompt: row.prompt || '',
          promptZh: row.promptZh || undefined,
          wordLimit: row.wordLimit ? parseInt(row.wordLimit) : undefined,
          isRequired: row.isRequired !== 'false',
          sourceUrl: row.sourceUrl || undefined,
        }));
        return apiClient.post<ImportResult>('/admin/essay-prompts/batch-import', {
          items,
          autoVerify,
        });
      } else {
        const items = data.map((row) => ({
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
          essayType: row.essayType || undefined,
          essayPrompt: row.essayPrompt || undefined,
          essayContent: row.essayContent || undefined,
        }));
        return apiClient.post<ImportResult>('/admin/cases/batch-import', {
          items,
          visibility: 'ANONYMOUS',
          autoVerify,
        });
      }
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['essayPrompts'] });
      queryClient.invalidateQueries({ queryKey: ['essayPromptStats'] });
      queryClient.invalidateQueries({ queryKey: ['adminCaseStats'] });
      queryClient.invalidateQueries({ queryKey: ['pendingEssays'] });
      toast.success(
        t('importSuccess', {
          imported: data.imported,
          skipped: data.skipped,
        })
      );
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportResult(null);

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setParsedData(results.data as Record<string, string>[]);
        },
        error: (err) => {
          toast.error(`CSV 解析失败: ${err.message}`);
        },
      });
    } else if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          const items = Array.isArray(json) ? json : json.items || [];
          setParsedData(items);
        } catch {
          toast.error('JSON 解析失败');
        }
      };
      reader.readAsText(file);
    } else {
      toast.error('请上传 .csv 或 .json 文件');
    }

    // Reset input so same file can be re-selected
    e.target.value = '';
  }, []);

  const handleDownloadTemplate = () => {
    const template = isEssayPrompt ? ESSAY_PROMPT_TEMPLATE : CASE_TEMPLATE;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = isEssayPrompt ? 'essay-prompts-template.csv' : 'cases-template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleClose = () => {
    setParsedData([]);
    setFileName('');
    setImportResult(null);
    setAutoVerify(false);
    onOpenChange(false);
  };

  const previewColumns = isEssayPrompt
    ? ['school', 'year', 'type', 'prompt', 'wordLimit']
    : ['school', 'major', 'year', 'round', 'result', 'essayType'];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{t('importDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Area */}
          {!importResult && (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('border-primary');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('border-primary');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-primary');
                const file = e.dataTransfer.files[0];
                if (file) {
                  const input = fileInputRef.current;
                  if (input) {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    input.files = dt.files;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }
              }}
            >
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {fileName ? `${fileName} (${parsedData.length} ${t('rows')})` : t('dropFileHere')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t('supportedFormats')}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {/* Download Template */}
          {!importResult && (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                {t('downloadTemplate')}
              </Button>
              <div className="flex items-center gap-2">
                <Switch id="auto-verify" checked={autoVerify} onCheckedChange={setAutoVerify} />
                <Label htmlFor="auto-verify">{t('autoVerify')}</Label>
              </div>
            </div>
          )}

          {/* Data Preview */}
          {parsedData.length > 0 && !importResult && (
            <div>
              <h4 className="text-sm font-medium mb-2">
                {t('preview')} ({parsedData.length} {t('rows')})
              </h4>
              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">#</TableHead>
                      {previewColumns.map((col) => (
                        <TableHead key={col}>{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 50).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        {previewColumns.map((col) => (
                          <TableCell key={col} className="max-w-[200px]">
                            <span className="line-clamp-1 text-sm">{row[col] || '-'}</span>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              {parsedData.length > 50 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('showingFirst50', { total: parsedData.length })}
                </p>
              )}
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                  <div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {importResult.imported}
                    </div>
                    <div className="text-sm text-muted-foreground">{t('imported')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                  <div>
                    <div className="text-2xl font-bold text-amber-600">{importResult.skipped}</div>
                    <div className="text-sm text-muted-foreground">{t('skipped')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10">
                  <XCircle className="h-8 w-8 text-red-500" />
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {importResult.errors.length}
                    </div>
                    <div className="text-sm text-muted-foreground">{t('errorsCount')}</div>
                  </div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <ScrollArea className="h-[200px] border rounded-lg p-3">
                  <div className="space-y-1">
                    {importResult.errors.slice(0, 20).map((err, i) => (
                      <div key={i} className="text-sm flex gap-2 items-start">
                        <Badge variant="outline" className="shrink-0">
                          {t('row')} {err.row}
                        </Badge>
                        <span className="text-muted-foreground">
                          {err.school}: {err.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importResult ? t('close') : t('cancel')}
          </Button>
          {!importResult && parsedData.length > 0 && (
            <Button
              onClick={() => importMutation.mutate(parsedData)}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('startImport', { count: parsedData.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
