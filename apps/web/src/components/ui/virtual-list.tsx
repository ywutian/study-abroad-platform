'use client';

import { useRef, ReactNode, useCallback, useMemo } from 'react';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================
// 类型定义
// ============================================

interface VirtualListProps<T> {
  items: T[];
  height: number | string;
  estimateSize: number;
  renderItem: (item: T, index: number, virtualItem: VirtualItem) => ReactNode;
  keyExtractor?: (item: T, index: number) => string | number;
  overscan?: number;
  gap?: number;
  className?: string;
  itemClassName?: string;
  emptyState?: ReactNode;
  loadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  animated?: boolean;
}

interface VirtualGridProps<T> {
  items: T[];
  height: number | string;
  columns: number | { sm?: number; md?: number; lg?: number; xl?: number };
  estimateSize: number;
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor?: (item: T, index: number) => string | number;
  overscan?: number;
  gap?: number;
  className?: string;
  emptyState?: ReactNode;
}

// ============================================
// 虚拟列表组件
// ============================================

export function VirtualList<T>({
  items,
  height,
  estimateSize,
  renderItem,
  keyExtractor = (_, i) => i,
  overscan = 5,
  gap = 0,
  className,
  itemClassName,
  emptyState,
  loadMore,
  hasMore,
  loadingMore,
  animated = true,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize + gap,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // 无限加载检测
  const handleScroll = useCallback(() => {
    if (!loadMore || !hasMore || loadingMore) return;

    const scrollEl = parentRef.current;
    if (!scrollEl) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollEl;
    if (scrollHeight - scrollTop - clientHeight < estimateSize * 3) {
      loadMore();
    }
  }, [loadMore, hasMore, loadingMore, estimateSize]);

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          const key = keyExtractor(item, virtualItem.index);

          const content = renderItem(item, virtualItem.index, virtualItem);

          if (animated) {
            return (
              <motion.div
                key={key}
                className={cn('absolute left-0 right-0', itemClassName)}
                style={{
                  top: virtualItem.start,
                  height: virtualItem.size - gap,
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: (virtualItem.index % 10) * 0.02 }}
              >
                {content}
              </motion.div>
            );
          }

          return (
            <div
              key={key}
              className={cn('absolute left-0 right-0', itemClassName)}
              style={{
                top: virtualItem.start,
                height: virtualItem.size - gap,
              }}
            >
              {content}
            </div>
          );
        })}
      </div>

      {loadingMore && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

// ============================================
// 虚拟网格组件
// ============================================

export function VirtualGrid<T>({
  items,
  height,
  columns,
  estimateSize,
  renderItem,
  keyExtractor = (_, i) => i,
  overscan = 3,
  gap = 16,
  className,
  emptyState,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // 响应式列数
  const getColumnCount = useCallback(() => {
    if (typeof columns === 'number') return columns;
    if (typeof window === 'undefined') return columns.md || 2;

    const width = window.innerWidth;
    if (width >= 1280 && columns.xl) return columns.xl;
    if (width >= 1024 && columns.lg) return columns.lg;
    if (width >= 768 && columns.md) return columns.md;
    return columns.sm || 1;
  }, [columns]);

  const columnCount = useMemo(() => getColumnCount(), [getColumnCount]);
  const rowCount = Math.ceil(items.length / columnCount);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize + gap,
    overscan,
  });

  const virtualRows = virtualizer.getVirtualItems();

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      style={{ height }}
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowItems = items.slice(startIndex, startIndex + columnCount);

          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 right-0"
              style={{
                top: virtualRow.start,
                height: virtualRow.size - gap,
              }}
            >
              <div
                className="grid h-full"
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                  gap,
                }}
              >
                {rowItems.map((item, colIndex) => {
                  const index = startIndex + colIndex;
                  const key = keyExtractor(item, index);
                  return (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2, delay: colIndex * 0.05 }}
                    >
                      {renderItem(item, index)}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// 简化版虚拟列表（用于简单场景）
// ============================================

interface SimpleVirtualListProps {
  itemCount: number;
  itemHeight: number;
  height: number | string;
  width?: number | string;
  children: (index: number, style: React.CSSProperties) => ReactNode;
  className?: string;
  overscan?: number;
}

export function SimpleVirtualList({
  itemCount,
  itemHeight,
  height,
  width = '100%',
  children,
  className,
  overscan = 5,
}: SimpleVirtualListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan,
  });

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      style={{ height, width }}
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const style: React.CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: virtualItem.size,
            transform: `translateY(${virtualItem.start}px)`,
          };

          return (
            <div key={virtualItem.key}>
              {children(virtualItem.index, style)}
            </div>
          );
        })}
      </div>
    </div>
  );
}



