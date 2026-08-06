'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle, XCircle, FileText, Loader2, User, GraduationCap } from 'lucide-react';
import Image from 'next/image';

interface VerificationDetail {
  id: string;
  userId: string;
  caseId: string;
  proofType: string;
  proofUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
  proofData?: string;
  user?: {
    email: string;
    profile?: { nickname?: string; avatarUrl?: string };
  };
  case?: {
    school?: { name: string; nameZh?: string };
    admissionResult?: string;
  };
  reviewer?: { email: string; profile?: { nickname?: string } };
}

interface VerificationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: VerificationDetail | undefined;
  detailLoading: boolean;
  reviewNote: string;
  onReviewNoteChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  isReviewPending: boolean;
}

const PROOF_TYPE_KEYS = new Set(['offer_letter', 'enrollment_proof', 'student_id', 'other']);

function normalizeProofType(value?: string | null) {
  return value && PROOF_TYPE_KEYS.has(value) ? value : 'other';
}

export function VerificationDetailDialog({
  open,
  onOpenChange,
  detail,
  detailLoading,
  reviewNote,
  onReviewNoteChange,
  onApprove,
  onReject,
  isReviewPending,
}: VerificationDetailDialogProps) {
  const t = useTranslations('admin');
  const tAria = useTranslations('common.aria');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('verifications.detail.title')}</DialogTitle>
          <DialogDescription>
            {detail?.id ? `ID: ${detail.id.slice(0, 8)}...` : ''}
          </DialogDescription>
        </DialogHeader>

        {detailLoading || !detail ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* User Info */}
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {t('verifications.detail.userInfo')}
              </h4>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={detail.user?.profile?.avatarUrl} />
                  <AvatarFallback>
                    {(detail.user?.profile?.nickname || detail.user?.email)?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{detail.user?.profile?.nickname || '—'}</p>
                  <p className="text-xs text-muted-foreground">{detail.user?.email}</p>
                </div>
              </div>
            </section>

            {/* Case Info */}
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" />
                {t('verifications.detail.caseInfo')}
              </h4>
              <div className="text-sm">
                <p>{detail.case?.school?.nameZh || detail.case?.school?.name || '—'}</p>
                {detail.case?.admissionResult && (
                  <Badge variant="secondary" className="mt-1">
                    {detail.case.admissionResult}
                  </Badge>
                )}
              </div>
            </section>

            {/* Proof */}
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {t('verifications.detail.proofPreview')}
              </h4>
              <p className="text-sm mb-2">
                {t(
                  `verifications.proofTypes.${normalizeProofType(detail.proofType)}` as Parameters<
                    typeof t
                  >[0]
                )}
              </p>
              {detail.proofUrl && (
                <div className="relative w-full max-h-60 overflow-hidden rounded-lg border">
                  <Image
                    src={detail.proofUrl}
                    alt={tAria('proofDocument')}
                    width={500}
                    height={300}
                    className="object-contain w-full"
                    unoptimized
                  />
                </div>
              )}
            </section>

            {/* Review Note (for pending) */}
            {detail.status === 'PENDING' && (
              <section>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {t('verifications.detail.reviewNote')}
                </h4>
                <Textarea
                  value={reviewNote}
                  onChange={(e) => onReviewNoteChange(e.target.value)}
                  placeholder={t('verifications.detail.reviewNotePlaceholder')}
                  rows={3}
                />
              </section>
            )}

            {/* Existing review info (for reviewed items) */}
            {detail.status !== 'PENDING' && detail.reviewNote && (
              <section>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  {t('verifications.detail.reviewNote')}
                </h4>
                <p className="text-sm bg-muted rounded-md p-3">{detail.reviewNote}</p>
              </section>
            )}
          </div>
        )}

        {/* Actions */}
        {detail?.status === 'PENDING' && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="destructive" onClick={onReject} disabled={isReviewPending}>
              <XCircle className="h-4 w-4 mr-1.5" />
              {t('verifications.actions.reject')}
            </Button>
            <Button onClick={onApprove} disabled={isReviewPending}>
              {isReviewPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1.5" />
              )}
              {t('verifications.actions.approve')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
