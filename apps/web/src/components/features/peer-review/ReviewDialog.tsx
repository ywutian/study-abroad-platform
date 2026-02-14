'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RatingInput } from './RatingInput';
import { Loader2, Star, BadgeCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

interface ReviewUser {
  id: string;
  name?: string;
  avatar?: string;
  isVerified: boolean;
}

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewId?: string; // 如果有 reviewId，则是提交评价；如果没有，则是发起互评
  targetUser?: ReviewUser;
  mode: 'request' | 'submit';
}

export function ReviewDialog({
  open,
  onOpenChange,
  reviewId,
  targetUser,
  mode,
}: ReviewDialogProps) {
  const t = useTranslations('peerReview');
  const queryClient = useQueryClient();

  const [profileScore, setProfileScore] = useState(0);
  const [helpfulScore, setHelpfulScore] = useState(0);
  const [responseScore, setResponseScore] = useState(0);
  const [overallScore, setOverallScore] = useState(0);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!targetUser) throw new Error('No target user');
      return apiClient.post(`/peer-reviews/request/${targetUser.id}`, {
        isAnonymous,
      });
    },
    onSuccess: () => {
      toast.success(t('requestSent'));
      queryClient.invalidateQueries({ queryKey: ['peer-reviews'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || t('requestFailed'));
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!reviewId) throw new Error('No review ID');
      return apiClient.post(`/peer-reviews/${reviewId}/submit`, {
        profileScore,
        helpfulScore,
        responseScore,
        overallScore,
        comment: comment || undefined,
      });
    },
    onSuccess: () => {
      toast.success(t('reviewSubmitted'));
      queryClient.invalidateQueries({ queryKey: ['peer-reviews'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || t('submitFailed'));
    },
  });

  const resetForm = () => {
    setProfileScore(0);
    setHelpfulScore(0);
    setResponseScore(0);
    setOverallScore(0);
    setComment('');
    setIsAnonymous(false);
  };

  const handleSubmit = () => {
    if (mode === 'request') {
      requestMutation.mutate();
    } else {
      if (profileScore === 0 || helpfulScore === 0 || responseScore === 0 || overallScore === 0) {
        toast.error(t('pleaseRateAll'));
        return;
      }
      submitMutation.mutate();
    }
  };

  const isLoading = requestMutation.isPending || submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            {mode === 'request' ? t('requestReview') : t('submitReview')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'request' ? t('requestDescription') : t('submitDescription')}
          </DialogDescription>
        </DialogHeader>

        {/* Target User Display */}
        {targetUser && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Avatar className="h-12 w-12 border">
              {targetUser.avatar ? (
                <AvatarImage src={targetUser.avatar} alt={targetUser.name || ''} />
              ) : (
                <AvatarFallback className="bg-primary/10 text-primary">
                  {targetUser.name?.[0] || '?'}
                </AvatarFallback>
              )}
            </Avatar>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-medium">{targetUser.name || t('anonymous')}</span>
                {targetUser.isVerified && <BadgeCheck className="h-4 w-4 text-emerald-500" />}
              </div>
              <p className="text-sm text-muted-foreground">
                {mode === 'request' ? t('willRequestReview') : t('evaluating')}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4 py-4">
          {mode === 'request' ? (
            /* Request Mode - Anonymous Toggle */
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('anonymous')}</Label>
                <p className="text-xs text-muted-foreground">{t('anonymousDescription')}</p>
              </div>
              <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
            </div>
          ) : (
            /* Submit Mode - Rating Inputs */
            <>
              <RatingInput
                label={t('profileScore')}
                description={t('profileScoreDesc')}
                value={profileScore}
                onChange={setProfileScore}
              />
              <RatingInput
                label={t('helpfulScore')}
                description={t('helpfulScoreDesc')}
                value={helpfulScore}
                onChange={setHelpfulScore}
              />
              <RatingInput
                label={t('responseScore')}
                description={t('responseScoreDesc')}
                value={responseScore}
                onChange={setResponseScore}
              />
              <RatingInput
                label={t('overallScore')}
                description={t('overallScoreDesc')}
                value={overallScore}
                onChange={setOverallScore}
              />

              <div className="space-y-2">
                <Label>{t('commentLabel')}</Label>
                <Textarea
                  placeholder={t('commentPlaceholder')}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground text-right">{comment.length}/500</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === 'request' ? t('sendRequest') : t('submitReview')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
