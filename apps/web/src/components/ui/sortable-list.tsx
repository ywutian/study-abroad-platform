'use client';

import { ReactNode, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// 类型定义
// ============================================

interface SortableItem {
  id: string | number;
  [key: string]: unknown;
}

interface SortableListProps<T extends SortableItem> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number, dragHandleProps: DragHandleProps) => ReactNode;
  keyExtractor?: (item: T) => UniqueIdentifier;
  direction?: 'vertical' | 'horizontal';
  className?: string;
  itemClassName?: string;
  disabled?: boolean;
  withOverlay?: boolean;
  renderOverlay?: (item: T) => ReactNode;
}

interface DragHandleProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners: any;
  isDragging: boolean;
}

// ============================================
// 可排序项组件
// ============================================

interface SortableItemWrapperProps {
  id: UniqueIdentifier;
  children: (props: DragHandleProps) => ReactNode;
  className?: string;
  disabled?: boolean;
}

function SortableItemWrapper({
  id,
  children,
  className,
  disabled,
}: SortableItemWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(className)}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

// ============================================
// 拖拽手柄组件
// ============================================

interface DragHandleButtonProps extends DragHandleProps {
  className?: string;
}

export function DragHandle({
  attributes,
  listeners,
  isDragging,
  className,
}: DragHandleButtonProps) {
  const t = useTranslations('ui.sortable');
  return (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className={cn(
        'p-1 rounded cursor-grab touch-none',
        'text-muted-foreground hover:text-foreground hover:bg-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isDragging && 'cursor-grabbing',
        className
      )}
      aria-label={t('dragToSort')}
    >
      <GripVertical className="w-4 h-4" />
    </button>
  );
}

// ============================================
// 主组件
// ============================================

export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
  keyExtractor = (item) => item.id,
  direction = 'vertical',
  className,
  itemClassName,
  disabled = false,
  withOverlay = true,
  renderOverlay,
}: SortableListProps<T>) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = items.findIndex((item) => keyExtractor(item) === active.id);
        const newIndex = items.findIndex((item) => keyExtractor(item) === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        onReorder(newItems);
      }

      setActiveId(null);
    },
    [items, onReorder, keyExtractor]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const activeItem = activeId
    ? items.find((item) => keyExtractor(item) === activeId)
    : null;

  const strategy =
    direction === 'horizontal'
      ? horizontalListSortingStrategy
      : verticalListSortingStrategy;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={items.map(keyExtractor)}
        strategy={strategy}
        disabled={disabled}
      >
        <div
          className={cn(
            direction === 'horizontal' ? 'flex gap-2' : 'space-y-2',
            className
          )}
        >
          {items.map((item, index) => (
            <SortableItemWrapper
              key={keyExtractor(item)}
              id={keyExtractor(item)}
              className={itemClassName}
              disabled={disabled}
            >
              {(dragHandleProps) => renderItem(item, index, dragHandleProps)}
            </SortableItemWrapper>
          ))}
        </div>
      </SortableContext>

      {withOverlay && (
        <DragOverlay>
          {activeItem ? (
            <div className="shadow-xl rounded-lg opacity-90">
              {renderOverlay
                ? renderOverlay(activeItem)
                : renderItem(
                    activeItem,
                    items.indexOf(activeItem),
                    {
                      attributes: {},
                      listeners: undefined,
                      isDragging: true,
                    }
                  )}
            </div>
          ) : null}
        </DragOverlay>
      )}
    </DndContext>
  );
}

// ============================================
// 简化版可排序卡片
// ============================================

interface SortableCardProps<T extends SortableItem> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderContent: (item: T, index: number) => ReactNode;
  keyExtractor?: (item: T) => UniqueIdentifier;
  className?: string;
}

export function SortableCards<T extends SortableItem>({
  items,
  onReorder,
  renderContent,
  keyExtractor = (item) => item.id,
  className,
}: SortableCardProps<T>) {
  return (
    <SortableList
      items={items}
      onReorder={onReorder}
      keyExtractor={keyExtractor}
      className={className}
      renderItem={(item, index, dragHandleProps) => (
        <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
          <DragHandle {...dragHandleProps} />
          <div className="flex-1">{renderContent(item, index)}</div>
        </div>
      )}
    />
  );
}

// ============================================
// 带编号的可排序列表
// ============================================

interface NumberedSortableListProps<T extends SortableItem> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderContent: (item: T, index: number) => ReactNode;
  keyExtractor?: (item: T) => UniqueIdentifier;
  className?: string;
}

export function NumberedSortableList<T extends SortableItem>({
  items,
  onReorder,
  renderContent,
  keyExtractor = (item) => item.id,
  className,
}: NumberedSortableListProps<T>) {
  return (
    <SortableList
      items={items}
      onReorder={onReorder}
      keyExtractor={keyExtractor}
      className={className}
      renderItem={(item, index, dragHandleProps) => (
        <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors">
          <DragHandle {...dragHandleProps} />
          <span className="w-6 h-6 flex items-center justify-center text-xs font-medium bg-primary/10 text-primary rounded-full">
            {index + 1}
          </span>
          <div className="flex-1">{renderContent(item, index)}</div>
        </div>
      )}
    />
  );
}



