'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Check,
  Loader2,
  Shield,
  AlertCircle,
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
  label: string;
  description: string;
  icon: React.ElementType;
}

const exportFormats: ExportFormatOption[] = [
  {
    id: 'json',
    label: 'JSON',
    description: '完整数据，适合备份',
    icon: FileJson,
  },
  {
    id: 'csv',
    label: 'CSV',
    description: '表格格式，可用 Excel 打开',
    icon: FileSpreadsheet,
  },
  {
    id: 'pdf',
    label: 'PDF',
    description: '打印友好的报告格式',
    icon: FileText,
  },
];

// 数据类型
interface DataTypeOption {
  id: string;
  label: string;
  description: string;
  size?: string;
}

const dataTypes: DataTypeOption[] = [
  {
    id: 'profile',
    label: '个人资料',
    description: '基本信息、学术背景、语言成绩',
    size: '~5KB',
  },
  {
    id: 'applications',
    label: '申请记录',
    description: '申请的学校、状态、时间线',
    size: '~10KB',
  },
  {
    id: 'favorites',
    label: '收藏内容',
    description: '收藏的学校、案例、文章',
    size: '~2KB',
  },
  {
    id: 'chat_history',
    label: 'AI 对话记录',
    description: '与 AI 助手的历史对话',
    size: '~50KB',
  },
  {
    id: 'settings',
    label: '偏好设置',
    description: '通知设置、显示偏好',
    size: '~1KB',
  },
];

interface DataExportDialogProps {
  trigger?: React.ReactNode;
}

export function DataExportDialog({ trigger }: DataExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'select' | 'exporting' | 'done'>('select');
  const [format, setFormat] = useState<ExportFormat>('json');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['profile', 'applications']);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // 切换数据类型选择
  const toggleType = (typeId: string) => {
    setSelectedTypes(prev => 
      prev.includes(typeId)
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  // 全选/取消全选
  const toggleAll = () => {
    if (selectedTypes.length === dataTypes.length) {
      setSelectedTypes([]);
    } else {
      setSelectedTypes(dataTypes.map(t => t.id));
    }
  };

  // 开始导出
  const handleExport = async () => {
    if (selectedTypes.length === 0) {
      toast.error('请至少选择一种数据类型');
      return;
    }

    setStep('exporting');
    setProgress(0);

    try {
      // 模拟导出过程
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
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
      toast.success('数据导出完成！');
    } catch (error) {
      toast.error('导出失败，请稍后重试');
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
            导出数据
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        {step === 'select' && (
          <>
            <DialogHeader>
              <DialogTitle>导出我的数据</DialogTitle>
              <DialogDescription>
                选择要导出的数据类型和格式，我们会为您生成下载文件。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* 格式选择 */}
              <div>
                <Label className="text-sm font-medium mb-3 block">导出格式</Label>
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
                          <span className="text-sm font-medium">{fmt.label}</span>
                          <span className="text-xs text-muted-foreground text-center">
                            {fmt.description}
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
                  <Label className="text-sm font-medium">选择数据</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-auto p-0 text-xs"
                    onClick={toggleAll}
                  >
                    {selectedTypes.length === dataTypes.length ? '取消全选' : '全选'}
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
                        <p className="text-sm font-medium">{type.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {type.description}
                        </p>
                      </div>
                      {type.size && (
                        <span className="text-xs text-muted-foreground">
                          {type.size}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 隐私提示 */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <Shield className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  您的数据安全加密传输。导出文件仅包含您选择的数据类型，不包含密码等敏感信息。
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button onClick={handleExport} disabled={selectedTypes.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                开始导出
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'exporting' && (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <h4 className="font-semibold mb-2">正在导出数据...</h4>
            <p className="text-sm text-muted-foreground mb-6">
              请稍候，正在处理您的数据
            </p>
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
            <h4 className="font-semibold mb-2">导出完成！</h4>
            <p className="text-sm text-muted-foreground mb-6">
              您的数据已准备好下载
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                下载文件
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                关闭
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
  dataType,
  format = 'csv',
  label = '导出',
  className,
}: {
  dataType: string;
  format?: ExportFormat;
  label?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      // 模拟导出
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('导出成功！');
    } catch {
      toast.error('导出失败');
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
      {label}
    </Button>
  );
}



