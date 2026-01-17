'use client';

/**
 * ListsTab — 用户榜单标签页
 *
 * 从 hall/page.tsx 拆分而来，负责：
 * - 公开榜单展示
 * - 创建新榜单
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { Plus, List, ThumbsUp } from 'lucide-react';
import { usePublicLists } from '@/hooks/use-hall-api';
import { CreateListDialog } from '@/components/features';

export function ListsTab() {
  const t = useTranslations();
  const [createListOpen, setCreateListOpen] = useState(false);

  // API hooks
  const { data: publicListsResponse, isLoading: listsLoading } = usePublicLists(true);

  return (
    <>
      <motion.div
        key="lists"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('hall.lists.title')}</h2>
          <Button
            onClick={() => setCreateListOpen(true)}
            className="gap-2 bg-primary hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {t('hall.lists.createList')}
          </Button>
        </div>

        {listsLoading ? (
          <LoadingState variant="card" count={4} />
        ) : publicListsResponse?.items && publicListsResponse.items.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publicListsResponse.items.map((list: any, index: number) => (
              <motion.div
                key={list.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all">
                  <div className="h-1 bg-primary" />
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {list.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 mt-1">
                          {list.description}
                        </CardDescription>
                      </div>
                      {list.category && <Badge variant="secondary">{list.category}</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        {t('hall.lists.byAuthor', {
                          name: list.user?.email?.split('@')[0] || t('common.anonymous'),
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-4 w-4" />
                        {list._count?.votes || 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-blue-500/10">
                <List className="h-8 w-8 text-blue-500/50" />
              </div>
              <p className="font-medium">{t('hall.lists.emptyTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('hall.lists.emptyDesc')}</p>
              <Button
                onClick={() => setCreateListOpen(true)}
                className="mt-6 gap-2"
                variant="outline"
              >
                <Plus className="h-4 w-4" />
                {t('hall.lists.createList')}
              </Button>
            </CardContent>
          </Card>
        )}
      </motion.div>

      <CreateListDialog open={createListOpen} onOpenChange={setCreateListOpen} />
    </>
  );
}
