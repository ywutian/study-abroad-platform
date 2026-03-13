'use client';

import { useTranslations } from 'next-intl';
import { Folder, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { VaultItemType, VaultStats } from './vault-types';
import { typeIcons, typeColors, VAULT_ITEM_TYPES } from './vault-constants';

interface VaultSidebarProps {
  selectedType: VaultItemType | 'ALL';
  selectedCategory: string | null;
  stats: VaultStats | null;
  onTypeChange: (type: VaultItemType | 'ALL') => void;
  onCategoryChange: (category: string | null) => void;
}

export function VaultSidebar({
  selectedType,
  selectedCategory,
  stats,
  onTypeChange,
  onCategoryChange,
}: VaultSidebarProps) {
  const t = useTranslations('vault');

  return (
    <div className="space-y-6">
      {/* Type Filter */}
      <Card className="bg-card border-border backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-lg flex items-center gap-2">
            <Folder className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            {t('categories')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant={selectedType === 'ALL' ? 'default' : 'ghost'}
            className={`w-full justify-start ${
              selectedType === 'ALL'
                ? 'bg-emerald-500 text-white'
                : 'text-muted-foreground hover:bg-muted'
            }`}
            onClick={() => onTypeChange('ALL')}
          >
            {t('allItems')}
          </Button>
          {VAULT_ITEM_TYPES.map((type) => (
            <Button
              key={type}
              variant={selectedType === type ? 'default' : 'ghost'}
              className={`w-full justify-start gap-2 ${
                selectedType === type
                  ? `bg-gradient-to-r ${typeColors[type]} text-white`
                  : 'text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => onTypeChange(type)}
            >
              {typeIcons[type]}
              {t(type.toLowerCase())}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Categories */}
      {stats && stats.categories.length > 0 && (
        <Card className="bg-card border-border backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-lg flex items-center gap-2">
              <Tag className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              {t('categories')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant={selectedCategory === null ? 'default' : 'ghost'}
              className={`w-full justify-start ${
                selectedCategory === null
                  ? 'bg-emerald-500 text-white'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => onCategoryChange(null)}
            >
              {t('allCategories')}
            </Button>
            {stats.categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'ghost'}
                className={`w-full justify-start ${
                  selectedCategory === cat
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
                onClick={() => onCategoryChange(cat)}
              >
                {cat}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
