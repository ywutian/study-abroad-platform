'use client';

/**
 * 浮动标签输入框 - Material Design 风格
 */

import { forwardRef, useState, useId, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';
import { Check, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface FloatingInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  error?: string;
  success?: boolean;
  hint?: string;
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(
  (
    {
      className,
      label,
      error,
      success,
      hint,
      size = 'md',
      type = 'text',
      leftIcon,
      rightIcon,
      disabled,
      value,
      defaultValue,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const id = useId();
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const prefersReducedMotion = useReducedMotion();

    const hasValue = value !== undefined ? !!value : !!defaultValue;
    const isActive = isFocused || hasValue;
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    const sizeStyles = {
      sm: 'h-10 text-sm',
      md: 'h-12 text-base',
      lg: 'h-14 text-lg',
    };

    const labelSizeStyles = {
      sm: isActive ? 'text-[10px] -translate-y-[18px]' : 'text-sm',
      md: isActive ? 'text-xs -translate-y-[22px]' : 'text-base',
      lg: isActive ? 'text-xs -translate-y-[26px]' : 'text-lg',
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    return (
      <div className="relative">
        <div
          className={cn(
            'relative rounded-lg border-2 transition-all duration-200',
            isFocused
              ? error
                ? 'border-destructive ring-2 ring-destructive/20'
                : 'border-primary ring-2 ring-primary/20'
              : error
                ? 'border-destructive/50'
                : 'border-input hover:border-input/80',
            success && !error && 'border-green-500/50',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          {/* Left Icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {leftIcon}
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            id={id}
            type={inputType}
            value={value}
            defaultValue={defaultValue}
            disabled={disabled}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={cn(
              'w-full bg-transparent px-3 pt-4 pb-1 outline-none',
              sizeStyles[size],
              leftIcon && 'pl-10',
              (rightIcon || isPassword || success || error) && 'pr-10'
            )}
            {...props}
          />

          {/* Floating Label */}
          <motion.label
            htmlFor={id}
            className={cn(
              'absolute left-3 pointer-events-none transition-all duration-200 origin-left',
              leftIcon && 'left-10',
              isActive
                ? error
                  ? 'text-destructive'
                  : 'text-primary'
                : 'text-muted-foreground',
              labelSizeStyles[size]
            )}
            initial={false}
            animate={
              prefersReducedMotion
                ? {}
                : {
                    y: isActive ? 0 : '50%',
                    scale: isActive ? 0.85 : 1,
                  }
            }
            style={{
              top: isActive ? '4px' : '50%',
              transform: isActive ? 'translateY(0) scale(0.85)' : 'translateY(-50%)',
            }}
          >
            {label}
          </motion.label>

          {/* Right Elements */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* Password Toggle */}
            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}

            {/* Success Icon */}
            <AnimatePresence>
              {success && !error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={transitions.springSnappy}
                >
                  <Check className="h-4 w-4 text-green-500" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Icon */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={transitions.springSnappy}
                >
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Custom Right Icon */}
            {rightIcon && !isPassword && !success && !error && rightIcon}
          </div>
        </div>

        {/* Error/Hint Message */}
        <AnimatePresence>
          {(error || hint) && (
            <motion.p
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              className={cn(
                'text-xs mt-1.5 px-1',
                error ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {error || hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

FloatingInput.displayName = 'FloatingInput';

// Floating Textarea
interface FloatingTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  maxLength?: number;
  showCount?: boolean;
}

const FloatingTextarea = forwardRef<HTMLTextAreaElement, FloatingTextareaProps>(
  (
    {
      className,
      label,
      error,
      hint,
      maxLength,
      showCount = false,
      disabled,
      value,
      defaultValue,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const id = useId();
    const [isFocused, setIsFocused] = useState(false);
    const [charCount, setCharCount] = useState(
      typeof value === 'string' ? value.length : typeof defaultValue === 'string' ? defaultValue.length : 0
    );

    const hasValue = value !== undefined ? !!value : !!defaultValue;
    const isActive = isFocused || hasValue;

    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      props.onChange?.(e);
    };

    return (
      <div className="relative">
        <div
          className={cn(
            'relative rounded-lg border-2 transition-all duration-200',
            isFocused
              ? error
                ? 'border-destructive ring-2 ring-destructive/20'
                : 'border-primary ring-2 ring-primary/20'
              : error
                ? 'border-destructive/50'
                : 'border-input hover:border-input/80',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          {/* Textarea */}
          <textarea
            ref={ref}
            id={id}
            value={value}
            defaultValue={defaultValue}
            disabled={disabled}
            maxLength={maxLength}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            className="w-full min-h-[120px] bg-transparent px-3 pt-6 pb-2 outline-none resize-none"
            {...props}
          />

          {/* Floating Label */}
          <label
            htmlFor={id}
            className={cn(
              'absolute left-3 pointer-events-none transition-all duration-200 origin-left',
              isActive
                ? 'top-2 text-xs ' + (error ? 'text-destructive' : 'text-primary')
                : 'top-4 text-base text-muted-foreground'
            )}
          >
            {label}
          </label>
        </div>

        {/* Bottom Row */}
        <div className="flex justify-between items-center mt-1.5 px-1">
          <AnimatePresence>
            {(error || hint) && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}
              >
                {error || hint}
              </motion.p>
            )}
          </AnimatePresence>

          {showCount && maxLength && (
            <span
              className={cn(
                'text-xs ml-auto',
                charCount > maxLength * 0.9 ? 'text-warning' : 'text-muted-foreground',
                charCount >= maxLength && 'text-destructive'
              )}
            >
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);

FloatingTextarea.displayName = 'FloatingTextarea';

export { FloatingInput, FloatingTextarea };




