'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Search, ChevronRight, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { VaultItem } from './vault-types';
import { typeIcons, typeColors, typeBgColors } from './vault-constants';

interface VaultItemsGridProps {
  items: VaultItem[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onViewItem: (itemId: string) => void;
}

export function VaultItemsGrid({
  items,
  loading,
  searchQuery,
  onSearchChange,
  onViewItem,
}: VaultItemsGridProps) {
  const t = useTranslations('vault');
  const format = useFormatter();

  const formatDate = (dateStr: string) => {
    return format.dateTime(new Date(dateStr), 'medium');
  };

  return (
    <div className="lg:col-span-3 space-y-6">
      {/* Search */}
      <Card className="bg-card border-border backdrop-blur-sm">
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </CardContent>
      </Card>

      {/* Items Grid */}
      <AnimatePresence mode="popLayout">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : items.length === 0 ? (
          <Card className="bg-card border-border backdrop-blur-sm">
            <CardContent className="py-12 text-center">
              <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground">{t('noItems')}</h3>
              <p className="text-muted-foreground mt-1">{t('noItemsDesc')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className="bg-card border-border backdrop-blur-sm hover:bg-muted/50 transition-all cursor-pointer group"
                  onClick={() => onViewItem(item.id)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-3 rounded-xl bg-gradient-to-br ${typeColors[item.type]} text-white`}
                      >
                        {typeIcons[item.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={typeBgColors[item.type]}>
                            {t(item.type.toLowerCase())}
                          </Badge>
                          {item.category && (
                            <Badge
                              variant="outline"
                              className="border-border text-muted-foreground"
                            >
                              {item.category}
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-foreground group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors truncate">
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                          {item.tags.slice(0, 2).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="bg-muted text-muted-foreground text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                          {item.tags.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{item.tags.length - 2}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {formatDate(item.updatedAt)}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
