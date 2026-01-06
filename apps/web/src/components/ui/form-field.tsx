'use client';

import { forwardRef, useId, useState } from 'react';
import { Check, Eye, EyeOff, X, AlertCircle, HelpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { PasswordStrength } from './password-strength';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 字段标签 */
  label?: string;
  /** 错误信息 */
  error?: string;
  /** 帮助文本 */
  helperText?: string;
  /** 提示信息 */
  tooltip?: string;
  /** 是否必填 */
  required?: boolean;
  /** 是否成功状态 */
  success?: boolean;
  /** 右侧元素 */
  endContent?: React.ReactNode;
  /** 左侧元素 */
  startContent?: React.ReactNode;
  /** 容器类名 */
  containerClassName?: string;
  /** 是否显示密码强度 */
  showPasswordStrength?: boolean;
  /** 是否显示字符计数 */
  showCharCount?: boolean;
  /** 最大字符数 */
  maxLength?: number;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({
    label,
    error,
    helperText,
    tooltip,
    required,
    success,
    endContent,
    startContent,
    containerClassName,
    showPasswordStrength,
    showCharCount,
    maxLength,
    type,
    className,
    value,
    ...props
  }, ref) => {
    const id = useId();
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;
    
    const charCount = typeof value === 'string' ? value.length : 0;
    const isOverLimit = maxLength && charCount > maxLength;

    return (
      <div className={cn('space-y-2', containerClassName)}>
        {/* 标签行 */}
        {(label || tooltip) && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {label && (
                <Label htmlFor={id} className={cn(error && 'text-destructive')}>
                  {label}
                  {required && <span className="text-destructive ml-0.5">*</span>}
                </Label>
              )}
              {tooltip && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">{tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {showCharCount && maxLength && (
              <span className={cn(
                'text-xs',
                isOverLimit ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {charCount}/{maxLength}
              </span>
            )}
          </div>
        )}

        {/* 输入框 */}
        <div className="relative">
          {startContent && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {startContent}
            </div>
          )}
          
          <Input
            ref={ref}
            id={id}
            type={inputType}
            value={value}
            className={cn(
              startContent && 'pl-10',
              (endContent || isPassword || error || success) && 'pr-10',
              error && 'border-destructive focus-visible:ring-destructive/30',
              success && 'border-success focus-visible:ring-success/30',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
            {...props}
          />

          {/* 右侧图标区域 */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {endContent}
            
            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            )}
            
            {error && !isPassword && (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
            
            {success && !error && (
              <Check className="h-4 w-4 text-success" />
            )}
          </div>
        </div>

        {/* 密码强度指示器 */}
        {showPasswordStrength && isPassword && typeof value === 'string' && value && (
          <PasswordStrength password={value} />
        )}

        {/* 错误或帮助文本 */}
        {error ? (
          <p id={`${id}-error`} className="text-xs text-destructive flex items-center gap-1">
            <X className="h-3 w-3" />
            {error}
          </p>
        ) : helperText ? (
          <p id={`${id}-helper`} className="text-xs text-muted-foreground">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

// Textarea 版本
interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  tooltip?: string;
  required?: boolean;
  showCharCount?: boolean;
  containerClassName?: string;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({
    label,
    error,
    helperText,
    tooltip,
    required,
    showCharCount,
    containerClassName,
    className,
    value,
    maxLength,
    ...props
  }, ref) => {
    const id = useId();
    const charCount = typeof value === 'string' ? value.length : 0;
    const isOverLimit = maxLength && charCount > maxLength;

    return (
      <div className={cn('space-y-2', containerClassName)}>
        {(label || tooltip || (showCharCount && maxLength)) && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {label && (
                <Label htmlFor={id} className={cn(error && 'text-destructive')}>
                  {label}
                  {required && <span className="text-destructive ml-0.5">*</span>}
                </Label>
              )}
              {tooltip && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">{tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {showCharCount && maxLength && (
              <span className={cn(
                'text-xs',
                isOverLimit ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {charCount}/{maxLength}
              </span>
            )}
          </div>
        )}

        <Textarea
          ref={ref}
          id={id}
          value={value}
          maxLength={maxLength}
          className={cn(
            error && 'border-destructive focus-visible:ring-destructive/30',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          {...props}
        />

        {error ? (
          <p id={`${id}-error`} className="text-xs text-destructive flex items-center gap-1">
            <X className="h-3 w-3" />
            {error}
          </p>
        ) : helperText ? (
          <p id={`${id}-helper`} className="text-xs text-muted-foreground">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

FormTextarea.displayName = 'FormTextarea';



