'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmojiPicker } from './EmojiPicker';
import { cn } from '@/lib/utils';
import { Send, Paperclip, Image as ImageIcon, X, Loader2 } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function MessageInput({
  onSend,
  onTyping,
  disabled,
  placeholder = '',
  className,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理输入变化 + 正在输入状态
  const handleChange = useCallback(
    (value: string) => {
      setMessage(value);

      // 发送正在输入状态
      if (onTyping) {
        onTyping(true);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          onTyping(false);
        }, 2000);
      }
    },
    [onTyping]
  );

  // 发送消息
  const handleSend = useCallback(async () => {
    const content = message.trim();
    if (!content || isSending) return;

    setIsSending(true);
    try {
      await onSend(content);
      setMessage('');
      setAttachments([]);
      inputRef.current?.focus();
    } finally {
      setIsSending(false);
      if (onTyping) {
        onTyping(false);
      }
    }
  }, [message, isSending, onSend, onTyping]);

  // 键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // 插入表情
  const handleEmojiSelect = useCallback((emoji: string) => {
    setMessage((prev) => prev + emoji);
    inputRef.current?.focus();
  }, []);

  // 文件选择
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files].slice(0, 5)); // 最多5个附件
  }, []);

  // 移除附件
  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={cn('space-y-2', className)}>
      {/* 附件预览 */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex gap-2 overflow-x-auto pb-2"
          >
            {attachments.map((file, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative shrink-0"
              >
                {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-16 w-16 rounded-lg object-cover border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-lg border bg-muted flex items-center justify-center">
                    <Paperclip className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(index)}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 输入区域 */}
      <div className="flex items-center gap-2">
        {/* 附件按钮 */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-10 w-10"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isSending}
        >
          <Paperclip className="h-5 w-5 text-muted-foreground" />
        </Button>

        {/* 图片按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-10 w-10 hidden sm:flex"
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.accept = 'image/*';
              fileInputRef.current.click();
              fileInputRef.current.accept = 'image/*,.pdf,.doc,.docx';
            }
          }}
          disabled={disabled || isSending}
        >
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
        </Button>

        {/* 输入框 */}
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isSending}
            className="pr-12 h-11"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <EmojiPicker onEmojiSelect={handleEmojiSelect} />
          </div>
        </div>

        {/* 发送按钮 */}
        <Button
          onClick={handleSend}
          disabled={disabled || isSending || !message.trim()}
          className="shrink-0 h-11 w-11 p-0 bg-primary hover:opacity-90"
        >
          {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
}
