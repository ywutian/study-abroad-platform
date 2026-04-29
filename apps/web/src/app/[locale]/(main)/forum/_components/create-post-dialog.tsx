'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImagePlus, Loader2, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiClient as api } from '@/lib/api';
import type { Category, Community, ForumImageInput, Post } from './forum-types';

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  communities: Community[];
  selectedCommunity: Community | null;
  onCommunityCreated: (community: Community) => void;
  onPostCreated: () => void;
}

export function CreatePostDialog({
  open,
  onOpenChange,
  categories,
  communities,
  selectedCommunity,
  onCommunityCreated,
  onPostCreated,
}: CreatePostDialogProps) {
  const t = useTranslations('forum');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [communityQuery, setCommunityQuery] = useState('');
  const [community, setCommunity] = useState<Community | null>(selectedCommunity);
  const [images, setImages] = useState<ForumImageInput[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creatingCommunity, setCreatingCommunity] = useState(false);

  const matches = useMemo(() => {
    const query = communityQuery.trim().toLowerCase();
    if (!query) return communities.slice(0, 8);
    return communities
      .filter((item) => item.name.toLowerCase().includes(query) || item.slug.includes(query))
      .slice(0, 8);
  }, [communities, communityQuery]);

  const canCreateCommunity =
    communityQuery.trim().length > 0 &&
    !communities.some((item) => item.name.toLowerCase() === communityQuery.trim().toLowerCase());

  const reset = () => {
    setTitle('');
    setContent('');
    setCommunityQuery('');
    setCommunity(selectedCommunity);
    setImages([]);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setCommunity(selectedCommunity);
    } else {
      reset();
    }
    onOpenChange(nextOpen);
  };

  const handleCreateCommunity = async () => {
    const name = communityQuery.trim();
    if (!name) return;
    setCreatingCommunity(true);
    try {
      const created = await api.post<Community>('/forums/communities', { name });
      setCommunity(created);
      onCommunityCreated(created);
      setCommunityQuery('');
    } finally {
      setCreatingCommunity(false);
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    const selected = Array.from(fileList || []);
    if (!selected.length) return;
    if (images.length + selected.length > MAX_IMAGES) {
      toast.error(t('imageLimitError', { count: MAX_IMAGES }));
      return;
    }
    const invalid = selected.find(
      (file) => !IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES
    );
    if (invalid) {
      toast.error(t('imageTypeSizeError'));
      return;
    }

    const form = new FormData();
    selected.forEach((file) => form.append('images', file));
    setUploading(true);
    try {
      const uploaded = await api.upload<ForumImageInput[]>('/forums/uploads/images', form);
      setImages((current) => [...current, ...uploaded].slice(0, MAX_IMAGES));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    const categoryId = categories[0]?.id;
    if (!categoryId || !community) return;
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        categoryId,
        communityId: community.id,
        tags: [community.name],
        images,
        isTeamPost: false,
      };
      const created = await api.post<Post>('/forums/posts', payload);
      if (created?.id) {
        reset();
        onOpenChange(false);
        onPostCreated();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    title.trim().length > 0 &&
    !!community &&
    !!categories[0]?.id &&
    (content.trim().length > 0 || images.length > 0) &&
    !submitting &&
    !uploading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('createNewPost')}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('communityLabel')}</label>
            {community && (
              <Badge variant="secondary" className="gap-1">
                r/{community.name}
                <button type="button" onClick={() => setCommunity(null)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {!community && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={communityQuery}
                    onChange={(event) => setCommunityQuery(event.target.value)}
                    placeholder={t('communitySearchPlaceholder')}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-md border">
                  {matches.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => setCommunity(item)}
                    >
                      <span>r/{item.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t('communityPostCount', { count: item.postCount })}
                      </span>
                    </button>
                  ))}
                  {canCreateCommunity && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-primary hover:bg-muted"
                      onClick={handleCreateCommunity}
                      disabled={creatingCommunity}
                    >
                      {creatingCommunity ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {t('createCommunityNamed', { name: communityQuery.trim() })}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('postTitleLabel')}</label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('postTitlePlaceholder')}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('contentLabel')}</label>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={t('contentPlaceholder')}
              className="min-h-[180px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('imageUploadLabel')}</label>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-center transition-colors hover:bg-muted/60">
              {uploading ? (
                <Loader2 className="mb-2 h-6 w-6 animate-spin text-primary" />
              ) : (
                <ImagePlus className="mb-2 h-6 w-6 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">{t('imageUploadAction')}</span>
              <span className="mt-1 text-xs text-muted-foreground">
                {t('imageUploadHint', { count: MAX_IMAGES })}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(event) => handleFiles(event.target.files)}
                disabled={uploading || images.length >= MAX_IMAGES}
              />
            </label>
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {images.map((image, index) => (
                  <div
                    key={image.key}
                    className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
                  >
                    <img src={image.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-background/90 p-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                      onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                      aria-label={t('removeImage')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {(submitting || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('publishPost')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
