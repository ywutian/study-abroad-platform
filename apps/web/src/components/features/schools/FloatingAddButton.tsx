'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Check, ListPlus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const ROUND_VALUES = ['ED', 'ED2', 'EA', 'REA', 'RD', 'ROLLING'] as const;

interface FloatingAddButtonProps {
  selectedSchools: SelectedSchool[];
  onAdd: (schoolIds: string[], tier: string, round: string) => void;
  onRemove: (schoolId: string) => void;
  onClear: () => void;
  isAdding?: boolean;
  className?: string;
}

/**
 * 底部操作栏 — 选校后展示选中数量、分类选择和批量添加按钮
 *
 * 替代原有的右下角浮动按钮，避免与 AI 聊天助手按钮位置重叠。
 * 使用 z-40（低于 FloatingChat 的 z-50），右侧留出空间避免遮挡。
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
  const t = useTranslations('schools');
  const tc = useTranslations('common');
  const [isOpen, setIsOpen] = useState(false);
  const [tier, setTier] = useState('TARGET');
  const [round, setRound] = useState('RD');
  const hasSelected = selectedSchools.length > 0;

  const handleAddAll = () => {
    if (selectedSchools.length > 0) {
      onAdd(
        selectedSchools.map((s) => s.id),
        tier,
        round
      );
    }
  };

  return (
    <>
      {/* 底部操作栏 */}
      <AnimatePresence>
        {hasSelected && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur-sm shadow-lg',
              className
            )}
          >
            <div className="flex items-center gap-3 px-4 py-3 max-w-screen-xl mx-auto pr-20">
              {/* 选中数量 — 点击展开 Sheet */}
              <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <ListPlus className="h-4 w-4 text-primary" />
                <Badge variant="secondary" className="text-sm font-medium">
                  {t('selectedCount', { count: selectedSchools.length })}
                </Badge>
              </button>

              {/* 分隔线 */}
              <div className="h-6 w-px bg-border" />

              {/* Tier 选择器 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {t('tierLabel')}:
                </span>
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REACH">{t('tiers.reach')}</SelectItem>
                    <SelectItem value="TARGET">{t('tiers.target')}</SelectItem>
                    <SelectItem value="SAFETY">{t('tiers.safety')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Round 选择器 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {t('roundLabel')}:
                </span>
                <Select value={round} onValueChange={setRound}>
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUND_VALUES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`rounds.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 弹性空间 */}
              <div className="flex-1" />

              {/* 清除按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                disabled={isAdding}
                className="text-muted-foreground"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">{tc('clearAll')}</span>
              </Button>

              {/* 添加按钮 */}
              <Button
                size="sm"
                onClick={handleAddAll}
                disabled={isAdding || selectedSchools.length === 0}
                className="gap-1.5"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tc('processing')}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {t('addAllToList')}
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <Loader2 className="h-4 w-4 animate-spin" />
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
