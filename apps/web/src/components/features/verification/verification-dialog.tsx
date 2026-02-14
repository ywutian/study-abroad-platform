'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Upload,
  FileCheck,
  AlertCircle,
  Loader2,
  BadgeCheck,
  GraduationCap,
  CreditCard,
} from 'lucide-react';

interface VerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  schoolName: string;
}

type ProofType = 'offer_letter' | 'enrollment_proof' | 'student_id';

const PROOF_TYPES = [
  {
    id: 'offer_letter' as ProofType,
    labelKey: 'verification.proofTypes.offerLetter',
    descKey: 'verification.proofTypes.offerLetterDesc',
    icon: BadgeCheck,
  },
  {
    id: 'enrollment_proof' as ProofType,
    labelKey: 'verification.proofTypes.enrollmentProof',
    descKey: 'verification.proofTypes.enrollmentProofDesc',
    icon: GraduationCap,
  },
  {
    id: 'student_id' as ProofType,
    labelKey: 'verification.proofTypes.studentId',
    descKey: 'verification.proofTypes.studentIdDesc',
    icon: CreditCard,
  },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function VerificationDialog({
  open,
  onOpenChange,
  caseId,
  schoolName,
}: VerificationDialogProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [proofType, setProofType] = useState<ProofType>('offer_letter');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async (data: { caseId: string; proofType: string; proofData: string }) => {
      return apiClient.post('/verifications', data);
    },
    onSuccess: () => {
      toast.success(t('verification.submitSuccess'));
      queryClient.invalidateQueries({ queryKey: ['my-verifications'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || t('verification.submitError'));
    },
  });

  const resetForm = () => {
    setProofType('offer_letter');
    setFile(null);
    setPreviewUrl(null);
  };

  const handleFileChange = useCallback(
    (selectedFile: File | null) => {
      if (!selectedFile) return;

      if (selectedFile.size > MAX_FILE_SIZE) {
        toast.error(t('verification.fileTooLarge'));
        return;
      }

      if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
        toast.error(t('verification.invalidFileType'));
        return;
      }

      setFile(selectedFile);

      // Create preview for images
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewUrl(e.target?.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setPreviewUrl(null);
      }
    },
    [t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      handleFileChange(droppedFile);
    },
    [handleFileChange]
  );

  const handleSubmit = async () => {
    if (!file) {
      toast.error(t('verification.noFile'));
      return;
    }

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      submitMutation.mutate({
        caseId,
        proofType,
        proofData: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-primary" />
            {t('verification.title')}
          </DialogTitle>
          <DialogDescription>
            {t('verification.description', { school: schoolName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 证明类型选择 */}
          <div className="space-y-3">
            <Label>{t('verification.selectProofType')}</Label>
            <RadioGroup
              value={proofType}
              onValueChange={(v) => setProofType(v as ProofType)}
              className="space-y-2"
            >
              {PROOF_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <div key={type.id}>
                    <RadioGroupItem
                      value={type.id}
                      id={`proof-${type.id}`}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={`proof-${type.id}`}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                        'peer-checked:border-primary peer-checked:bg-primary/5',
                        'hover:border-muted-foreground/50'
                      )}
                    >
                      <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">{t(type.labelKey)}</p>
                        <p className="text-xs text-muted-foreground">{t(type.descKey)}</p>
                      </div>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* 文件上传 */}
          <div className="space-y-3">
            <Label>{t('verification.uploadProof')}</Label>
            <div
              className={cn(
                'relative border-2 border-dashed rounded-lg p-6 transition-colors',
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
                'hover:border-primary/50'
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              {file ? (
                <div className="flex items-center gap-3">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 flex items-center justify-center bg-muted rounded-lg">
                      <FileCheck className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setPreviewUrl(null);
                    }}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 font-medium">{t('verification.dropOrClick')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('verification.fileRequirements')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 提示信息 */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-xs">{t('verification.privacyNote')}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!file || submitMutation.isPending}>
            {submitMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.loading')}
              </>
            ) : (
              <>
                <BadgeCheck className="mr-2 h-4 w-4" />
                {t('verification.submit')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
