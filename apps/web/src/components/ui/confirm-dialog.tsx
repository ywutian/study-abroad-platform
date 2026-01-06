'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle, Trash2, Info, HelpCircle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// 确认对话框类型
type ConfirmType = 'danger' | 'warning' | 'info' | 'question';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  type?: ConfirmType;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

// 类型配置
const typeConfig: Record<ConfirmType, { icon: React.ElementType; iconClass: string; buttonClass: string }> = {
  danger: {
    icon: Trash2,
    iconClass: 'text-destructive bg-destructive/10',
    buttonClass: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-warning bg-warning/10',
    buttonClass: 'bg-warning text-warning-foreground hover:bg-warning/90',
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-500 bg-blue-500/10',
    buttonClass: '',
  },
  question: {
    icon: HelpCircle,
    iconClass: 'text-primary bg-primary/10',
    buttonClass: '',
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  type = 'question',
  confirmLabel = '确认',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const config = typeConfig[type];
  const Icon = config.icon;

  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  }, [onConfirm, onOpenChange]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  const showLoading = loading || isLoading;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[400px]">
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full', config.iconClass)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              {description && (
                <AlertDialogDescription className="mt-2">
                  {description}
                </AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel 
            onClick={handleCancel}
            disabled={showLoading}
            className="w-full sm:w-auto"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            disabled={showLoading}
            className={cn('w-full sm:w-auto', config.buttonClass)}
          >
            {showLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Hook: useConfirm
interface UseConfirmOptions {
  title: string;
  description?: string;
  type?: ConfirmType;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    options: UseConfirmOptions | null;
    resolve: ((value: boolean) => void) | null;
  }>({
    open: false,
    options: null,
    resolve: null,
  });

  const confirm = useCallback((options: UseConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState({ open: false, options: null, resolve: null });
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState({ open: false, options: null, resolve: null });
  }, [state.resolve]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      handleCancel();
    }
  }, [handleCancel]);

  const ConfirmDialogComponent = state.options ? (
    <ConfirmDialog
      open={state.open}
      onOpenChange={handleOpenChange}
      title={state.options.title}
      description={state.options.description}
      type={state.options.type}
      confirmLabel={state.options.confirmLabel}
      cancelLabel={state.options.cancelLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, ConfirmDialog: ConfirmDialogComponent };
}

// 删除确认对话框
interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName?: string;
  onConfirm: () => void | Promise<void>;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemName,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      type="danger"
      title={itemName ? `删除 "${itemName}"？` : '确认删除？'}
      description="此操作无法撤销，删除后数据将永久丢失。"
      confirmLabel="删除"
      onConfirm={onConfirm}
    />
  );
}



