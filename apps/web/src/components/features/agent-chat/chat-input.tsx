'use client';

/**
 * 聊天输入组件 - 带动画效果
 */

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Square, Sparkles, Paperclip, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  showExtras?: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  isLoading,
  placeholder = '输入你的问题...',
  disabled,
  showExtras = false,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const handleSend = useCallback(() => {
    if (!value.trim() || disabled || isLoading) return;
    onSend(value.trim());
    setValue('');
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    textareaRef.current?.focus();
  }, [value, disabled, isLoading, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // 自动调整高度
  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, []);

  const hasContent = value.trim().length > 0;

  return (
    <motion.div 
      className={cn(
        'relative border-t bg-background/95 backdrop-blur transition-all duration-200',
        isFocused && 'border-t-primary/50'
      )}
      initial={false}
      animate={{ 
        boxShadow: isFocused 
          ? '0 -4px 20px rgba(99, 102, 241, 0.08)' 
          : '0 0 0 transparent' 
      }}
    >
      {/* Loading indicator bar */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0, opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50 origin-left"
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2 p-3 sm:p-4">
        {/* Extra buttons */}
        {showExtras && (
          <motion.div 
            className="flex gap-1"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={transitions.springGentle}
          >
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              disabled={disabled || isLoading}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              disabled={disabled || isLoading}
            >
              <Mic className="h-4 w-4" />
            </Button>
          </motion.div>
        )}

        {/* Input container */}
        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'min-h-[44px] max-h-[160px] resize-none pr-12 rounded-2xl',
              'border-2 transition-all duration-200',
              'scrollbar-thin scrollbar-thumb-muted',
              isFocused 
                ? 'border-primary/50 shadow-sm' 
                : 'border-input hover:border-input/80',
              disabled && 'opacity-50'
            )}
            rows={1}
          />

          {/* Character count (when typing long message) */}
          <AnimatePresence>
            {value.length > 100 && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute left-3 -top-5 text-[10px] text-muted-foreground"
              >
                {value.length} 字符
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Send/Stop button */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="stop"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90 }}
                transition={transitions.springSnappy}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onStop}
                  className={cn(
                    'h-10 w-10 rounded-full',
                    'bg-destructive/10 hover:bg-destructive/20 text-destructive',
                    'ring-2 ring-destructive/20'
                  )}
                >
                  <Square className="h-4 w-4" />
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="send"
                initial={{ scale: 0, rotate: 90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: -90 }}
                transition={transitions.springSnappy}
              >
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!hasContent || disabled}
                  className={cn(
                    'h-10 w-10 rounded-full transition-all duration-200',
                    hasContent
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {hasContent ? (
                    <Send className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pulse effect when ready to send */}
          {hasContent && !isLoading && !prefersReducedMotion && (
            <motion.span
              className="absolute inset-0 rounded-full bg-primary/30"
              animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </div>
      </div>

      {/* Hint text */}
      <AnimatePresence>
        {isFocused && !hasContent && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-[11px] text-muted-foreground text-center pb-2 -mt-1"
          >
            按 <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Enter</kbd> 发送，
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Shift + Enter</kbd> 换行
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
