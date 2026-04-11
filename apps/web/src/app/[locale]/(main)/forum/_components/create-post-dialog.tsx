'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { Users, PenLine, X, Loader2, ShieldAlert, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient as api } from '@/lib/api';
import Link from 'next/link';
import type { Category, Post } from './forum-types';
import { getCategoryIcon, getCategoryColorStyle, renderMarkdown } from './forum-types';

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  isVerified: boolean;
  initialTeamPost?: boolean;
  onPostCreated: () => void;
}

export function CreatePostDialog({
  open,
  onOpenChange,
  categories,
  isVerified,
  initialTeamPost = false,
  onPostCreated,
}: CreatePostDialogProps) {
  const t = useTranslations('forum');
  const locale = useLocale();
  const legacyTeamPostsEnabled = false;

  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formTagInput, setFormTagInput] = useState('');
  const [isTeamPost, setIsTeamPost] = useState(false);
  const [formTeamSize, setFormTeamSize] = useState(5);
  const [formDeadline, setFormDeadline] = useState('');
  const [formRequirements, setFormRequirements] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [_showPreview, setShowPreview] = useState(false);

  const suggestedTags = useMemo(
    () => ['MIT', 'Stanford', 'Harvard', 'CS', 'GPA', 'GRE', 'TOEFL', 'SAT', 'ACT'],
    []
  );

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormCategory('');
    setFormTags([]);
    setFormTagInput('');
    setIsTeamPost(false);
    setFormTeamSize(5);
    setFormDeadline('');
    setFormRequirements('');
    setShowPreview(false);
  };

  const handleCreatePost = async () => {
    if (!formTitle.trim() || !formContent.trim() || !formCategory) return;

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: formTitle,
        content: formContent,
        categoryId: formCategory,
        tags: formTags,
        isTeamPost: false,
      };
      if (legacyTeamPostsEnabled && isTeamPost) {
        payload.teamSize = formTeamSize;
        payload.teamDeadline = formDeadline;
        payload.requirements = formRequirements;
      }

      const res = await api.post<Post>('/forums/posts', payload);
      if (res && res.id) {
        onOpenChange(false);
        resetForm();
        onPostCreated();
      }
    } catch {
      // Error handled by global MutationCache toast
    } finally {
      setSubmitting(false);
    }
  };

  const addTag = (tag: string) => {
    if (!formTags.includes(tag) && formTags.length < 5) {
      setFormTags([...formTags, tag]);
    }
    setFormTagInput('');
  };

  const removeTag = (tag: string) => {
    setFormTags(formTags.filter((t) => t !== tag));
  };

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && formTagInput.trim()) {
      e.preventDefault();
      addTag(formTagInput.trim());
    }
  };

  // Sync initialTeamPost when dialog opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setIsTeamPost(false);
    } else {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {isTeamPost ? (
              <>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
                  <Users className="h-4 w-4 text-white" />
                </div>
                {t('createTeamPost')}
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <PenLine className="h-4 w-4 text-white" />
                </div>
                {t('createNewPost')}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="w-full grid grid-cols-2 mb-4">
              <TabsTrigger value="edit" onClick={() => setShowPreview(false)}>
                {t('editTab')}
              </TabsTrigger>
              <TabsTrigger value="preview" onClick={() => setShowPreview(true)}>
                {t('previewTab')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-4 mt-0">
              {!legacyTeamPostsEnabled && (
                <Alert className="bg-amber-50 border-amber-200">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="flex items-center justify-between text-amber-800">
                    <span className="text-sm">{t('legacyTeamReadOnly')}</span>
                    <Link
                      href="/teams"
                      className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium"
                    >
                      {t('openTeams')} <ArrowRight className="h-3 w-3" />
                    </Link>
                  </AlertDescription>
                </Alert>
              )}

              {/* Title */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  {t('postTitleLabel')}
                </label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t('postTitlePlaceholder')}
                  className="text-base"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground/70 mt-1 text-right">
                  {formTitle.length}/100
                </p>
              </div>

              {/* Category */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  {t('categoryLabel')}
                </label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectPostCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          {getCategoryIcon(cat)}
                          {locale === 'zh' ? cat.nameZh || cat.name : cat.name || cat.nameZh}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Content */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  {t('contentLabel')}
                </label>
                <Textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder={t('contentPlaceholder')}
                  className="min-h-[200px] resize-none"
                />
                <p className="text-xs text-muted-foreground/70 mt-1 text-right">
                  {t('charCount', { count: formContent.length })}
                </p>
              </div>

              {/* Team Options */}
              {legacyTeamPostsEnabled && isTeamPost && (
                <div className="space-y-4 p-4 bg-amber-50/50 rounded-lg border border-amber-100">
                  <h4 className="font-medium text-amber-800 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {t('teamSettingsTitle')}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">
                        {t('teamMembersLabel')}
                      </label>
                      <Input
                        type="number"
                        value={formTeamSize}
                        onChange={(e) => setFormTeamSize(Number(e.target.value))}
                        min={2}
                        max={20}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">
                        {t('teamDeadlineLabel')}
                      </label>
                      <Input
                        type="date"
                        value={formDeadline}
                        onChange={(e) => setFormDeadline(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">
                      {t('teamRequirementsDesc')}
                    </label>
                    <Textarea
                      value={formRequirements}
                      onChange={(e) => setFormRequirements(e.target.value)}
                      placeholder={t('teamReqPlaceholder')}
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Tags */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  {t('maxTags')}
                </label>
                {formTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {formTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                        #{tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-red-500">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={formTagInput}
                    onChange={(e) => setFormTagInput(e.target.value)}
                    onKeyDown={handleTagInput}
                    placeholder={t('tagsPlaceholder')}
                    disabled={formTags.length >= 5}
                  />
                </div>
                {formTags.length < 5 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {suggestedTags
                      .filter((t) => !formTags.includes(t))
                      .slice(0, 8)
                      .map((tag) => (
                        <button
                          key={tag}
                          className="text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 px-2 py-0.5 rounded transition-colors"
                          onClick={() => addTag(tag)}
                        >
                          +{tag}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-0">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {formCategory &&
                      (() => {
                        const category = categories.find((c) => c.id === formCategory);
                        return (
                          <Badge
                            className={`${category ? getCategoryColorStyle(category).className : 'bg-gray-500 dark:bg-gray-600'} text-white text-xs`}
                          >
                            {getLocalizedName(category?.nameZh, category?.name, locale) ||
                              t('unchosenCategory')}
                          </Badge>
                        );
                      })()}
                    {isTeamPost && (
                      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {t('teamProgress', { current: 1, total: formTeamSize })}
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-xl font-bold mb-3">{formTitle || t('postTitlePreview')}</h2>
                  <div className="prose prose-sm max-w-none text-muted-foreground">
                    {formContent ? (
                      renderMarkdown(formContent)
                    ) : (
                      <p className="text-muted-foreground/70">{t('contentPreviewText')}</p>
                    )}
                  </div>
                  {formTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t">
                      {formTags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs text-primary bg-primary/5 px-2 py-1 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t shrink-0">
          <p className="text-xs text-muted-foreground">{t('agreeRules')}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreatePost}
              disabled={submitting || !formTitle.trim() || !formContent.trim() || !formCategory}
              className={
                isTeamPost
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                  : ''
              }
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isTeamPost ? t('publishTeam') : t('publishPost')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
