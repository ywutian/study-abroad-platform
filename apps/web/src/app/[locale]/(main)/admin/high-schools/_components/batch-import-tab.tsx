'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { Upload, FileJson, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ name: string; error: string }>;
}

export function BatchImportTab() {
  const t = useTranslations('admin.highSchools');
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  const importMutation = useMutation({
    mutationFn: (schools: Record<string, unknown>[]) =>
      apiClient.post<ImportResult>(adminRoutes.highSchoolsBatchImport(), { schools }),
    onSuccess: (data) => {
      const result = data as unknown as ImportResult;
      setLastResult(result);
      queryClient.invalidateQueries({ queryKey: ['adminHighSchools'] });
      toast.success(
        t('import.importComplete', { created: result.created, updated: result.updated })
      );
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setJsonText(text);
      validateJson(text);
    };
    reader.readAsText(file);
  };

  const validateJson = (text: string) => {
    setParseError(null);
    setParsedCount(null);
    setLastResult(null);

    if (!text.trim()) return;

    try {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : parsed.schools;
      if (!Array.isArray(arr)) {
        setParseError(t('import.mustBeArray'));
        return;
      }
      // Validate required fields
      const invalid = arr.filter((s: Record<string, unknown>) => !s.name || !s.country || !s.type);
      if (invalid.length > 0) {
        setParseError(t('import.missingFields', { count: invalid.length }));
      }
      setParsedCount(arr.length);
    } catch {
      setParseError(t('import.invalidJsonFormat'));
    }
  };

  const handleImport = () => {
    if (!jsonText.trim()) return;

    try {
      const parsed = JSON.parse(jsonText);
      const arr = Array.isArray(parsed) ? parsed : parsed.schools;
      importMutation.mutate(arr);
    } catch {
      toast.error(t('import.invalidJson'));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body-sm font-medium">{t('import.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t.rich('import.description', {
              name: () => <code className="text-xs bg-muted px-1 py-0.5 rounded">name</code>,
              country: () => <code className="text-xs bg-muted px-1 py-0.5 rounded">country</code>,
              type: () => <code className="text-xs bg-muted px-1 py-0.5 rounded">type</code>,
            })}
          </p>

          {/* File upload */}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FileJson className="h-4 w-4 mr-2" />
              {t('import.loadJsonFile')}
            </Button>
            {parsedCount !== null && (
              <Badge variant="secondary">{t('import.schoolsParsed', { count: parsedCount })}</Badge>
            )}
            {parseError && <Badge variant="destructive">{parseError}</Badge>}
          </div>

          {/* JSON textarea */}
          <Textarea
            placeholder={`[\n  {\n    "name": "School Name",\n    "country": "US",\n    "state": "CA",\n    "type": "PRIVATE_US",\n    "recognition": 3,\n    "academicRigor": 3,\n    ...\n  }\n]`}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              validateJson(e.target.value);
            }}
            className="font-mono text-xs min-h-[200px]"
          />

          {/* Import button */}
          <Button
            onClick={handleImport}
            disabled={importMutation.isPending || !parsedCount || !!parseError}
          >
            {importMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {t('import.importButton', { count: parsedCount ?? 0 })}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {lastResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-body-sm font-medium">{t('import.resultsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm">
                  <span className="font-medium">{lastResult.created}</span> {t('import.created')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  <span className="font-medium">{lastResult.updated}</span> {t('import.updated')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  <span className="font-medium">{lastResult.skipped}</span> {t('import.skipped')}
                </span>
              </div>
            </div>

            {lastResult.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {t('import.errorsCount', { count: lastResult.errors.length })}
                </p>
                <div className="max-h-[200px] overflow-y-auto text-xs font-mono space-y-0.5">
                  {lastResult.errors.map((err, i) => (
                    <div key={i} className="text-muted-foreground">
                      {err.name}: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body-sm font-medium">{t('import.pipelineTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">{t('import.pipelineIntro')}</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              <strong>{t('import.step1Label')}</strong>{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                {t('import.step1Command')}
              </code>
              <br />
              <span className="ml-5">{t('import.step1Output')}</span>
            </li>
            <li>
              <strong>{t('import.step2Label')}</strong>{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                {t('import.step2Command')}
              </code>
              <br />
              <span className="ml-5">{t('import.step2Alt')}</span>
            </li>
            <li>
              <strong>{t('import.step3Label')}</strong>{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                {t('import.step3Command')}
              </code>
              <br />
              <span className="ml-5">{t('import.step3Output')}</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
