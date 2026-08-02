'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import {
  caseRoutes,
  verificationRoutes,
  VERIFICATION_PROOF_TYPE,
  type VerificationProofType,
  type VerificationSubmission,
} from '@study-abroad/shared';
import { cn } from '@/lib/utils';
import {
  Upload,
  FileCheck,
  Shield,
  AlertTriangle,
  X,
  Loader2,
  CheckCircle2,
  FileText,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';

interface VerificationUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId?: string;
  schoolName?: string;
}

const PROOF_TYPES: { value: VerificationProofType; labelKey: string }[] = [
  { value: VERIFICATION_PROOF_TYPE.OFFER_LETTER, labelKey: 'verification.proofType.offerLetter' },
  {
    value: VERIFICATION_PROOF_TYPE.ENROLLMENT_PROOF,
    labelKey: 'verification.proofType.enrollment',
  },
  { value: VERIFICATION_PROOF_TYPE.STUDENT_ID, labelKey: 'verification.proofType.studentId' },
];

interface MyCase {
  id: string;
  school?: { name?: string; nameZh?: string };
  schoolName?: string;
  year?: number;
}

const MAX_FILE_SIZE = 7 * 1024 * 1024;

export function VerificationUploadDialog({
  open,
  onOpenChange,
  caseId,
  schoolName,
}: VerificationUploadDialogProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [proofType, setProofType] = useState<VerificationProofType>(
    VERIFICATION_PROOF_TYPE.OFFER_LETTER
  );
  const [selectedCaseId, setSelectedCaseId] = useState(caseId ?? '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  const { data: myCases = [] } = useQuery<MyCase[]>({
    queryKey: ['myCases'],
    queryFn: () => apiClient.get(caseRoutes.mine()),
    enabled: open && !caseId,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(file);
        });
      } else {
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return null;
        });
      }
    }
  }, []);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    onDropRejected: (rejections) =>
      toast.error(
        rejections.some((item) => item.errors.some((error) => error.code === 'file-too-large'))
          ? t('verification.fileTooLarge')
          : t('verification.invalidFileType')
      ),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const resolvedCaseId = caseId ?? selectedCaseId;
      if (!selectedFile || !resolvedCaseId) {
        throw new Error(t('verification.pleaseSelectFile'));
      }
      setUploadProgress(20);
      const proofData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(selectedFile);
      });
      setUploadProgress(80);
      const payload: VerificationSubmission = {
        caseId: resolvedCaseId,
        proofType,
        proofData,
      };
      const result = await apiClient.post(verificationRoutes.submit(), payload);
      setUploadProgress(100);
      return result;
    },
    onSuccess: () => {
      toast.success(t('verification.submitSuccess'));
      queryClient.invalidateQueries({ queryKey: ['myVerifications'] });
      queryClient.invalidateQueries({ queryKey: ['myCases'] });
      handleClose();
    },
    onError: () => {
      setUploadProgress(0);
      // Error toast handled by global MutationCache
    },
  });

  const handleClose = () => {
    setStep(1);
    setSelectedFile(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setUploadProgress(0);
    setProofType(VERIFICATION_PROOF_TYPE.OFFER_LETTER);
    setSelectedCaseId(caseId ?? '');
    onOpenChange(false);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleSubmit = () => {
    if (!selectedFile) {
      toast.error(t('verification.pleaseSelectFile'));
      return;
    }
    submitMutation.mutate();
  };

  const isSubmitting = submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            {t('verification.title')}
          </DialogTitle>
          <DialogDescription>
            {schoolName
              ? t('verification.descriptionWithSchool', { school: schoolName })
              : t('verification.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          {/* 步骤指示器 */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                    step >= s ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
                </div>
                {s < 2 && (
                  <div
                    className={cn(
                      'h-0.5 w-12 transition-colors',
                      step > s ? 'bg-blue-500' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {!caseId && (
                  <div className="space-y-2">
                    <Label>{t('verification.caseLabel')}</Label>
                    <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('verification.selectCase')} />
                      </SelectTrigger>
                      <SelectContent>
                        {myCases.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.school?.nameZh || item.school?.name || item.schoolName || item.id}
                            {item.year ? ` · ${item.year}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {myCases.length === 0 && (
                      <p className="text-xs text-muted-foreground">{t('verification.noCases')}</p>
                    )}
                  </div>
                )}
                {/* 证明类型选择 */}
                <div className="space-y-2">
                  <Label>{t('verification.proofTypeLabel')}</Label>
                  <Select
                    value={proofType}
                    onValueChange={(v) => setProofType(v as VerificationProofType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROOF_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {t(type.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 文件上传区 */}
                <div className="space-y-2">
                  <Label>{t('verification.uploadLabel')}</Label>
                  <div
                    {...getRootProps()}
                    className={cn(
                      'relative rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer',
                      isDragActive
                        ? 'border-blue-500 bg-blue-500/5'
                        : 'border-muted-foreground/25 hover:border-blue-500/50 hover:bg-muted/50',
                      selectedFile && 'border-emerald-500 bg-emerald-500/5'
                    )}
                  >
                    <input {...getInputProps()} />

                    {selectedFile ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-center">
                          {previewUrl ? (
                            <div className="relative">
                              <Image
                                src={previewUrl}
                                alt={t('common.aria.preview')}
                                width={128}
                                height={128}
                                className={cn(
                                  'h-32 w-auto rounded-lg object-cover shadow-md',
                                  !showPreview && 'blur-md'
                                )}
                                unoptimized
                              />
                              <Button
                                variant="secondary"
                                size="sm"
                                className="absolute bottom-2 left-1/2 -translate-x-1/2 gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowPreview(!showPreview);
                                }}
                              >
                                {showPreview ? (
                                  <>
                                    <EyeOff className="h-3 w-3" />
                                    {t('verification.hidePreview')}
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-3 w-3" />
                                    {t('verification.showPreview')}
                                  </>
                                )}
                              </Button>
                            </div>
                          ) : (
                            <FileText className="h-16 w-16 text-emerald-500" />
                          )}
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <FileCheck className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm font-medium">{selectedFile.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile();
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4 mr-1" />
                          {t('verification.removeFile')}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
                            <Upload className="h-8 w-8 text-blue-500" />
                          </div>
                        </div>
                        <div>
                          <p className="font-medium">
                            {isDragActive
                              ? t('verification.dropHere')
                              : t('verification.dragOrClick')}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t('verification.supportedFormats')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 隐私提示 */}
                <Alert className="bg-amber-500/10 border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-sm">
                    {t('verification.privacyTip')}
                  </AlertDescription>
                </Alert>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={handleClose}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={() => setStep(2)}
                    disabled={!selectedFile || !(caseId ?? selectedCaseId)}
                    className="bg-primary hover:opacity-90"
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* 确认信息 */}
                <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    {t('verification.confirmInfo')}
                  </h4>

                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t('verification.proofTypeLabel')}:
                      </span>
                      <Badge variant="secondary">
                        {t(PROOF_TYPES.find((p) => p.value === proofType)?.labelKey || '')}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('verification.fileLabel')}:</span>
                      <span className="font-medium">{selectedFile?.name}</span>
                    </div>
                    {schoolName && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {t('verification.schoolLabel')}:
                        </span>
                        <span className="font-medium">{schoolName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 审核说明 */}
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
                  <h4 className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {t('verification.reviewProcess')}
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>{t('verification.reviewStep1')}</li>
                    <li>{t('verification.reviewStep2')}</li>
                    <li>{t('verification.reviewStep3')}</li>
                  </ul>
                </div>

                {/* 上传进度 */}
                {isSubmitting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{t('verification.uploading')}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}

                <div className="flex justify-between gap-3 pt-4">
                  <Button variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>
                    {t('common.back')}
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="bg-primary hover:opacity-90 gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('verification.submitting')}
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4" />
                        {t('verification.submit')}
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
