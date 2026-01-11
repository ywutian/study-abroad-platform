'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { pdf } from '@react-pdf/renderer';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Download,
  FileText,
  Loader2,
  Check,
  User,
  GraduationCap,
  BookOpen,
  Trophy,
  Target,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

import { BasicTemplate } from './templates/basic-template';
import { ProfessionalTemplate } from './templates/professional-template';
import type { ResumeData, ResumeExportOptions } from './styles/pdf-styles';

interface ResumeExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileData: any; // Profile data from API
}

const TEMPLATE_OPTIONS = [
  {
    id: 'basic' as const,
    labelKey: 'resume.templates.basic',
    descKey: 'resume.templates.basicDesc',
    icon: FileText,
  },
  {
    id: 'professional' as const,
    labelKey: 'resume.templates.professional',
    descKey: 'resume.templates.professionalDesc',
    icon: Sparkles,
  },
];

const MODULE_OPTIONS = [
  { id: 'basic', labelKey: 'resume.modules.basic', icon: User },
  { id: 'academics', labelKey: 'resume.modules.academics', icon: GraduationCap },
  { id: 'activities', labelKey: 'resume.modules.activities', icon: BookOpen },
  { id: 'awards', labelKey: 'resume.modules.awards', icon: Trophy },
  { id: 'targetSchools', labelKey: 'resume.modules.targetSchools', icon: Target },
];

export function ResumeExportDialog({ open, onOpenChange, profileData }: ResumeExportDialogProps) {
  const t = useTranslations();
  const [isExporting, setIsExporting] = useState(false);
  const [options, setOptions] = useState<ResumeExportOptions>({
    template: 'basic',
    language: 'zh',
    includeModules: {
      basic: true,
      academics: true,
      activities: true,
      awards: true,
      targetSchools: true,
    },
    anonymize: false,
  });

  // 转换 Profile 数据为 Resume 数据格式
  const resumeData: ResumeData = useMemo(() => {
    if (!profileData) {
      return {
        basic: {},
        academics: { testScores: [] },
        activities: [],
        awards: [],
        targetSchools: [],
      };
    }

    return {
      basic: {
        name: profileData.realName,
        grade: profileData.grade,
        school: profileData.currentSchool,
        targetMajor: profileData.targetMajor,
      },
      academics: {
        gpa: profileData.gpa ? Number(profileData.gpa) : undefined,
        gpaScale: profileData.gpaScale ? Number(profileData.gpaScale) : 4.0,
        testScores: (profileData.testScores || []).map((s: any) => ({
          type: s.type,
          score: s.score,
          subScores: s.subScores,
        })),
      },
      activities: (profileData.activities || []).map((a: any) => ({
        name: a.name,
        category: a.category,
        role: a.role,
        description: a.description,
        hoursPerWeek: a.hoursPerWeek,
        weeksPerYear: a.weeksPerYear,
        isOngoing: a.isOngoing,
      })),
      awards: (profileData.awards || []).map((a: any) => ({
        name: a.name,
        level: a.level,
        year: a.year,
        description: a.description,
      })),
      targetSchools: [], // TODO: 从 target schools 获取
    };
  }, [profileData]);

  // 检查是否有足够数据导出
  const hasEnoughData = useMemo(() => {
    const hasBasic = resumeData.basic.grade || resumeData.basic.targetMajor;
    const hasAcademics = resumeData.academics.gpa || resumeData.academics.testScores.length > 0;
    const hasActivities = resumeData.activities.length > 0;
    const hasAwards = resumeData.awards.length > 0;
    
    return hasBasic || hasAcademics || hasActivities || hasAwards;
  }, [resumeData]);

  // 切换模块
  const toggleModule = (moduleId: string) => {
    setOptions(prev => ({
      ...prev,
      includeModules: {
        ...prev.includeModules,
        [moduleId]: !prev.includeModules[moduleId as keyof typeof prev.includeModules],
      },
    }));
  };

  // 导出 PDF
  const handleExport = async () => {
    if (!hasEnoughData) {
      toast.error(t('resume.toast.noData'));
      return;
    }

    setIsExporting(true);

    try {
      // 选择模板
      const TemplateComponent = options.template === 'professional' 
        ? ProfessionalTemplate 
        : BasicTemplate;

      // 生成 PDF Blob
      const blob = await pdf(
        <TemplateComponent data={resumeData} options={options} />
      ).toBlob();

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `resume-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 清理
      setTimeout(() => URL.revokeObjectURL(url), 100);

      toast.success(t('resume.toast.success'));
      onOpenChange(false);
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error(t('resume.toast.failed'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {t('resume.title')}
          </DialogTitle>
          <DialogDescription>
            {t('resume.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 模板选择 */}
          <div>
            <Label className="text-sm font-medium mb-3 block">{t('resume.selectTemplate')}</Label>
            <RadioGroup
              value={options.template}
              onValueChange={(v) => setOptions(prev => ({ ...prev, template: v as 'basic' | 'professional' }))}
              className="grid grid-cols-2 gap-3"
            >
              {TEMPLATE_OPTIONS.map((template) => {
                const isSelected = options.template === template.id;
                const Icon = template.icon;
                return (
                  <div key={template.id}>
                    <RadioGroupItem
                      value={template.id}
                      id={`template-${template.id}`}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={`template-${template.id}`}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-muted-foreground/50'
                      )}
                    >
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                        isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-medium">{t(template.labelKey)}</span>
                      <span className="text-xs text-muted-foreground text-center">
                        {t(template.descKey)}
                      </span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* 模块选择 */}
          <div>
            <Label className="text-sm font-medium mb-3 block">{t('resume.selectModules')}</Label>
            <div className="space-y-2">
              {MODULE_OPTIONS.map((module) => {
                const isChecked = options.includeModules[module.id as keyof typeof options.includeModules];
                const Icon = module.icon;
                return (
                  <motion.div
                    key={module.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      isChecked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    )}
                    onClick={() => toggleModule(module.id)}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleModule(module.id)}
                    />
                    <Icon className={cn('h-4 w-4', isChecked ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="text-sm">{t(module.labelKey)}</span>
                    {isChecked && (
                      <Check className="h-4 w-4 text-primary ml-auto" />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* 语言和匿名选项 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 语言选择 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('resume.language')}</Label>
              <RadioGroup
                value={options.language}
                onValueChange={(v) => setOptions(prev => ({ ...prev, language: v as 'zh' | 'en' }))}
                className="flex gap-2"
              >
                <div className="flex items-center">
                  <RadioGroupItem value="zh" id="lang-zh" className="peer sr-only" />
                  <Label
                    htmlFor="lang-zh"
                    className={cn(
                      'px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors',
                      options.language === 'zh' ? 'border-primary bg-primary/10' : 'hover:bg-muted'
                    )}
                  >
                    中文
                  </Label>
                </div>
                <div className="flex items-center">
                  <RadioGroupItem value="en" id="lang-en" className="peer sr-only" />
                  <Label
                    htmlFor="lang-en"
                    className={cn(
                      'px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors',
                      options.language === 'en' ? 'border-primary bg-primary/10' : 'hover:bg-muted'
                    )}
                  >
                    English
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* 匿名模式 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('resume.anonymize')}</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={options.anonymize}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, anonymize: checked }))}
                />
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  {options.anonymize ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {options.anonymize ? t('resume.anonymizeOn') : t('resume.anonymizeOff')}
                </span>
              </div>
            </div>
          </div>

          {/* 数据不足警告 */}
          {!hasEnoughData && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-600">
              {t('resume.noDataWarning')}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || !hasEnoughData}
            className="gap-2"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting ? t('resume.exporting') : t('resume.export')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



