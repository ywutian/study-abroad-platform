'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Check,
  Loader2,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// 导出格式
type ExportFormat = 'json' | 'csv' | 'pdf';

interface ExportFormatOption {
  id: ExportFormat;
  labelKey: string;
  icon: React.ElementType;
}

const exportFormats: ExportFormatOption[] = [
  { id: 'json', labelKey: 'json', icon: FileJson },
  { id: 'csv', labelKey: 'csv', icon: FileSpreadsheet },
  { id: 'pdf', labelKey: 'pdf', icon: FileText },
];

// 数据类型
interface DataTypeOption {
  id: string;
  labelKey: string;
  size?: string;
}

const dataTypes: DataTypeOption[] = [
  { id: 'profile', labelKey: 'profile', size: '~5KB' },
  { id: 'applications', labelKey: 'applications', size: '~10KB' },
  { id: 'favorites', labelKey: 'favorites', size: '~2KB' },
  { id: 'chat_history', labelKey: 'aiChats', size: '~50KB' },
  { id: 'settings', labelKey: 'preferences', size: '~1KB' },
];

interface DataExportDialogProps {
  trigger?: React.ReactNode;
}

export function DataExportDialog({ trigger }: DataExportDialogProps) {
  const t = useTranslations('dataExport');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'select' | 'exporting' | 'done'>('select');
  const [format, setFormat] = useState<ExportFormat>('json');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['profile', 'applications']);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // 切换数据类型选择
  const toggleType = (typeId: string) => {
    setSelectedTypes((prev) =>
      prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]
    );
  };

  // 全选/取消全选
  const toggleAll = () => {
    if (selectedTypes.length === dataTypes.length) {
      setSelectedTypes([]);
    } else {
      setSelectedTypes(dataTypes.map((t) => t.id));
    }
  };

  // 开始导出
  const handleExport = async () => {
    if (selectedTypes.length === 0) {
      toast.error(t('toast.selectDataType'));
      return;
    }

    setStep('exporting');
    setProgress(0);

    try {
      // 模拟导出过程
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        setProgress(i);
      }

      // 实际应该调用 API
      // const blob = await api.exportData({
      //   format,
      //   types: selectedTypes,
      // });

      // 模拟生成下载链接
      const mockData = {
        exportedAt: new Date().toISOString(),
        format,
        types: selectedTypes,
        data: {
          // ... actual data
        },
      };

      const blob = new Blob([JSON.stringify(mockData, null, 2)], {
        type: format === 'json' ? 'application/json' : 'text/csv',
      });

      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStep('done');
      toast.success(t('toast.success'));
    } catch (_error) {
      toast.error(t('toast.failed'));
      setStep('select');
    }
  };

  // 下载文件
  const handleDownload = () => {
    if (!downloadUrl) return;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `study-abroad-export-${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 清理
    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }, 100);
  };

  // 重置状态
  const handleReset = () => {
    setStep('select');
    setProgress(0);
    setDownloadUrl(null);
  };

  // 关闭时重置
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(handleReset, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            {t('trigger')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        {step === 'select' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription>{t('description')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* 格式选择 */}
              <div>
                <Label className="text-sm font-medium mb-3 block">{t('formatLabel')}</Label>
                <RadioGroup
                  value={format}
                  onValueChange={(v) => setFormat(v as ExportFormat)}
                  className="grid grid-cols-3 gap-3"
                >
                  {exportFormats.map((fmt) => {
                    const Icon = fmt.icon;
                    return (
                      <div key={fmt.id}>
                        <RadioGroupItem
                          value={fmt.id}
                          id={`format-${fmt.id}`}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={`format-${fmt.id}`}
                          className={cn(
                            'flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all',
                            'peer-checked:border-primary peer-checked:bg-primary/5',
                            'hover:border-muted-foreground/50'
                          )}
                        >
                          <Icon className="w-6 h-6" />
                          <span className="text-sm font-medium">
                            {t(`formats.${fmt.labelKey}.label`)}
                          </span>
                          <span className="text-xs text-muted-foreground text-center">
                            {t(`formats.${fmt.labelKey}.description`)}
                          </span>
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>

              {/* 数据类型选择 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium">{t('selectDataLabel')}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={toggleAll}
                  >
                    {selectedTypes.length === dataTypes.length ? t('deselectAll') : t('selectAll')}
                  </Button>
                </div>
                <div className="space-y-2">
                  {dataTypes.map((type) => (
                    <div
                      key={type.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        selectedTypes.includes(type.id)
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      )}
                      onClick={() => toggleType(type.id)}
                    >
                      <Checkbox
                        checked={selectedTypes.includes(type.id)}
                        onCheckedChange={() => toggleType(type.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {t(`dataTypes.${type.labelKey}.label`)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t(`dataTypes.${type.labelKey}.description`)}
                        </p>
                      </div>
                      {type.size && (
                        <span className="text-xs text-muted-foreground">{type.size}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 隐私提示 */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <Shield className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">{t('securityNote')}</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button onClick={handleExport} disabled={selectedTypes.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                {t('startExport')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'exporting' && (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <h4 className="font-semibold mb-2">{t('exportingTitle')}</h4>
            <p className="text-sm text-muted-foreground mb-6">{t('exportingDescription')}</p>
            <div className="max-w-xs mx-auto">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">{progress}%</p>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring' }}
              className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"
            >
              <Check className="w-8 h-8 text-success" />
            </motion.div>
            <h4 className="font-semibold mb-2">{t('exportCompleteTitle')}</h4>
            <p className="text-sm text-muted-foreground mb-6">{t('exportCompleteDescription')}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                {t('downloadFile')}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {tCommon('close')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// 快速导出按钮（用于特定数据）
export function QuickExportButton({
  dataType: _dataType,
  format: _format = 'csv',
  label,
  className,
}: {
  dataType: string;
  format?: ExportFormat;
  label?: string;
  className?: string;
}) {
  const t = useTranslations('dataExport');
  const [loading, setLoading] = useState(false);
  const displayLabel = label || t('trigger');

  const handleExport = async () => {
    setLoading(true);
    try {
      // 模拟导出
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success(t('toast.success'));
    } catch {
      toast.error(t('toast.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={handleExport}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-2" />
      )}
      {displayLabel}
    </Button>
  );
}
