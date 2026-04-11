'use client';

import { useTranslations } from 'next-intl';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { MessageSquare, Users, PenLine, Flame, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Category } from './forum-types';
import { getCategoryIcon, getCategoryColorStyle } from './forum-types';

interface CategorySidebarProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  showTeamOnly: boolean;
  onToggleTeamOnly: () => void;
  forumStats: { postCount: number; userCount: number; teamingCount: number; activeToday: number };
  locale: string;
  suggestedTags: string[];
  onTagClick: (tag: string) => void;
  onCreatePost: () => void;
  onCreateTeamPost: () => void;
  allowLegacyTeamPosts?: boolean;
  formatNumber: (num: number) => string;
}

export function CategorySidebar({
  categories,
  selectedCategory,
  onSelectCategory,
  showTeamOnly,
  onToggleTeamOnly,
  forumStats,
  locale,
  suggestedTags,
  onTagClick,
  onCreatePost,
  onCreateTeamPost,
  allowLegacyTeamPosts = false,
  formatNumber: _formatNumber,
}: CategorySidebarProps) {
  const t = useTranslations('forum');

  return (
    <div className="lg:col-span-3 space-y-4">
      {/* Categories */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            {t('categoryFilter')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="space-y-1">
            <button
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                selectedCategory === null && !showTeamOnly
                  ? 'bg-primary text-white'
                  : 'hover:bg-muted'
              }`}
              onClick={() => {
                onSelectCategory(null);
                if (showTeamOnly) onToggleTeamOnly();
              }}
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {t('allPosts')}
              </span>
              <span className="text-xs opacity-70">{forumStats.postCount}</span>
            </button>

            {allowLegacyTeamPosts && (
              <button
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                  showTeamOnly
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                    : 'hover:bg-muted'
                }`}
                onClick={() => {
                  onToggleTeamOnly();
                  onSelectCategory(null);
                }}
              >
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('teamPosts')}
                </span>
                <span className="text-xs opacity-70">{forumStats.teamingCount}</span>
              </button>
            )}

            <div className="h-px bg-muted my-2" />

            {categories.map((category) => {
              const colorStyle = getCategoryColorStyle(category);
              const isSelected = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                    isSelected ? 'text-white' : 'hover:bg-muted'
                  } ${isSelected ? colorStyle.className : ''}`}
                  style={isSelected ? colorStyle.style : undefined}
                  onClick={() => {
                    onSelectCategory(category.id);
                    if (showTeamOnly) onToggleTeamOnly();
                  }}
                >
                  <span className="flex items-center gap-2">
                    {getCategoryIcon(category)}
                    {getLocalizedName(category.nameZh, category.name, locale)}
                  </span>
                  <span className="text-xs opacity-70">{category.postCount}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Create */}
      <Card className="bg-gradient-to-br from-primary to-blue-600 text-white overflow-hidden">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-2">{t('quickPost')}</h3>
          <p className="text-sm text-white/80 mb-3">{t('quickPostDesc')}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur"
              onClick={onCreatePost}
            >
              <PenLine className="h-3.5 w-3.5 mr-1" />
              {t('postAction')}
            </Button>
            {allowLegacyTeamPosts && (
              <Button
                size="sm"
                className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur"
                onClick={onCreateTeamPost}
              >
                <Users className="h-3.5 w-3.5 mr-1" />
                {t('teamUp')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hot Tags */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            {t('hotTags')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1.5">
            {suggestedTags.slice(0, 10).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="cursor-pointer hover:bg-primary hover:text-white transition-colors text-xs"
                onClick={() => onTagClick(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
