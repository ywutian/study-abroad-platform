'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Check, ListPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLocale, useTranslations } from 'next-intl';
import { cn, getSchoolName, getSchoolSubName } from '@/lib/utils';

export interface SelectedSchool {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
}

interface FloatingAddButtonProps {
  selectedSchools: SelectedSchool[];
  onAdd: (schoolIds: string[]) => void;
  onRemove: (schoolId: string) => void;
  onClear: () => void;
  isAdding?: boolean;
  className?: string;
}

/**
 * 右下角常驻浮动按钮
 *
 * 功能：
 * - 显示已选学校数量
 * - 点击展开已选学校列表
 * - 支持批量添加到清单
 * - 支持清除选择
 */
export function FloatingAddButton({
  selectedSchools,
  onAdd,
  onRemove,
  onClear,
  isAdding = false,
  className,
}: FloatingAddButtonProps) {
  const locale = useLocale();
  const t = useTranslations('findCollege');
  const tc = useTranslations('common');
  const [isOpen, setIsOpen] = useState(false);
  const hasSelected = selectedSchools.length > 0;

  const handleAddAll = () => {
    if (selectedSchools.length > 0) {
      onAdd(selectedSchools.map((s) => s.id));
    }
  };

  return (
    <>
      {/* 浮动按钮 */}
      <motion.div
        className={cn('fixed bottom-6 right-6 z-50', className)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <Button
          size="lg"
          className={cn(
            'rounded-full shadow-lg h-14 w-14 p-0 relative',
            'hover:scale-105 active:scale-95 transition-transform',
            hasSelected
              ? 'bg-primary hover:bg-primary/90'
              : 'bg-muted hover:bg-muted/90 text-muted-foreground'
          )}
          onClick={() => hasSelected && setIsOpen(true)}
          disabled={!hasSelected}
        >
          <ListPlus className="h-6 w-6" />

          {/* 数量徽章 */}
          <AnimatePresence>
            {hasSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1"
              >
                <Badge className="h-6 min-w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold bg-red-500 hover:bg-red-500 border-2 border-background">
                  {selectedSchools.length}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </Button>

        {/* 提示文字 */}
        {!hasSelected && (
          <p className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
            {t('selectHint')}
          </p>
        )}
      </motion.div>

      {/* 已选学校面板 */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ListPlus className="h-5 w-5" />
              {t('selectedSchools')}
              <Badge variant="secondary">
                {t('selectedCount', { count: selectedSchools.length })}
              </Badge>
            </SheetTitle>
            <SheetDescription>{t('batchAddDesc')}</SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[60vh] mt-4 pr-4">
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {selectedSchools.map((school, index) => (
                  <motion.div
                    key={school.id}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* 排名 */}
                      <div className="shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        #{school.usNewsRank || '-'}
                      </div>
                      {/* 名称 */}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {getSchoolName(school, locale)}
                        </p>
                        {getSchoolSubName(school, locale) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {getSchoolSubName(school, locale)}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* 移除按钮 */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onRemove(school.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>

          <SheetFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={onClear}
              className="flex-1 gap-2"
              disabled={isAdding}
            >
              <Trash2 className="h-4 w-4" />
              {tc('clearAll')}
            </Button>
            <Button
              onClick={handleAddAll}
              className="flex-1 gap-2"
              disabled={isAdding || selectedSchools.length === 0}
            >
              {isAdding ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  >
                    <Plus className="h-4 w-4" />
                  </motion.div>
                  {tc('processing')}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {t('addAllToList')}
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
