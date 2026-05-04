'use client';

/**
 * 聊天输入组件 - 带动画效果
 */

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Square, Sparkles, Paperclip, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';
import { pushAgentChatDebug } from './debug';

interface ChatInputProps {
  onSend: (message: string) => void | boolean | Promise<void | boolean>;
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
  placeholder,
  disabled,
  showExtras = false,
}: ChatInputProps) {
  const t = useTranslations('agentChat');
  const tAria = useTranslations('common.aria');
  const finalPlaceholder = placeholder ?? t('placeholder');
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const handleSend = useCallback(async () => {
    const trimmedValue = value.trim();
    pushAgentChatDebug('handleSend_invoked', {
      trimmedValueLength: trimmedValue.length,
      disabled: Boolean(disabled),
      isLoading: Boolean(isLoading),
    });
    if (!trimmedValue || disabled || isLoading) {
      pushAgentChatDebug('handleSend_rejected_local', {
        reason: !trimmedValue ? 'empty' : disabled ? 'disabled' : 'loading',
        trimmedValueLength: trimmedValue.length,
      });
      return;
    }
    const accepted = await onSend(trimmedValue);
    pushAgentChatDebug('handleSend_onSend_resolved', {
      accepted: accepted === true,
      acceptedRaw: accepted == null ? String(accepted) : accepted,
      trimmedValueLength: trimmedValue.length,
    });
    if (accepted !== true) {
      textareaRef.current?.focus();
      return;
    }
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  }, [value, disabled, isLoading, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      pushAgentChatDebug('textarea_keydown', {
        key: e.key,
        shiftKey: e.shiftKey,
        trimmedValueLength: e.currentTarget.value.trim().length,
        disabled: Boolean(disabled),
        isLoading: Boolean(isLoading),
      });
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

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
        boxShadow: isFocused ? '0 -4px 20px rgba(221, 184, 90, 0.14)' : '0 0 0 transparent',
      }}
    >
      {/* Loading indicator bar */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0, opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-0.5 bg-primary origin-left"
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
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground sm:h-9 sm:w-9"
              disabled={disabled || isLoading}
              aria-label={tAria('attachFile')}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground sm:h-9 sm:w-9"
              disabled={disabled || isLoading}
              aria-label={tAria('voiceInput')}
            >
              <Mic className="h-4 w-4" />
            </Button>
          </motion.div>
        )}

        {/* Input container */}
        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            suppressHydrationWarning
            value={value}
            onChange={(e) => {
              pushAgentChatDebug('textarea_change', {
                valueLength: e.target.value.length,
                trimmedValueLength: e.target.value.trim().length,
                disabled: Boolean(disabled),
                isLoading: Boolean(isLoading),
              });
              setValue(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={finalPlaceholder}
            disabled={disabled}
            className={cn(
              'min-h-[44px] max-h-[160px] resize-none pr-12 rounded-lg',
              'border-2 transition-all duration-200',
              'scrollbar-thin scrollbar-thumb-muted',
              isFocused ? 'border-primary/50 shadow-sm' : 'border-input hover:border-input/80',
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
                className="absolute left-3 -top-5 text-2xs text-muted-foreground"
              >
                {value.length} {t('characters')}
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
                  aria-label={tAria('stopGenerating')}
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
                  onClick={() => {
                    void handleSend();
                  }}
                  disabled={!hasContent || disabled}
                  aria-label={tAria('sendMessage')}
                  className={cn(
                    'h-10 w-10 rounded-full transition-all duration-200',
                    hasContent
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {hasContent ? <Send className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pulse effect when ready to send */}
          {hasContent && !isLoading && !prefersReducedMotion && (
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-full bg-primary/30"
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
            className="text-xs text-muted-foreground text-center pb-2 -mt-1"
          >
            {t('sendHint')}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
