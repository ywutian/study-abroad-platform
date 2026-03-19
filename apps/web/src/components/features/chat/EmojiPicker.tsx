'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const EMOJI_CATEGORY_DATA = [
  {
    key: 'frequent',
    emojis: [
      '😀',
      '😂',
      '🤣',
      '😊',
      '😍',
      '🥰',
      '😘',
      '😎',
      '🤔',
      '😅',
      '😢',
      '😭',
      '😤',
      '🙄',
      '😴',
      '🤗',
      '👍',
      '👎',
      '👏',
      '🙏',
      '💪',
      '❤️',
      '💔',
      '✨',
      '🔥',
      '💯',
      '🎉',
      '🎊',
    ],
  },
  {
    key: 'smileys',
    emojis: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😆',
      '😅',
      '🤣',
      '😂',
      '🙂',
      '🙃',
      '😉',
      '😊',
      '😇',
      '🥰',
      '😍',
      '🤩',
      '😘',
      '😗',
      '😚',
      '😙',
      '🥲',
      '😋',
      '😛',
      '😜',
      '🤪',
      '😝',
      '🤑',
      '🤗',
    ],
  },
  {
    key: 'gestures',
    emojis: [
      '👍',
      '👎',
      '👌',
      '🤌',
      '🤏',
      '✌️',
      '🤞',
      '🤟',
      '🤘',
      '🤙',
      '👈',
      '👉',
      '👆',
      '👇',
      '☝️',
      '👋',
      '🤚',
      '🖐️',
      '✋',
      '🖖',
      '👏',
      '🙌',
      '🤲',
      '🤝',
      '🙏',
      '💪',
      '🦾',
      '🦿',
    ],
  },
  {
    key: 'symbols',
    emojis: [
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '🤎',
      '💔',
      '❣️',
      '💕',
      '💞',
      '💓',
      '💗',
      '💖',
      '💘',
      '💝',
      '✨',
      '⭐',
      '🌟',
      '💫',
      '⚡',
      '🔥',
      '💥',
      '🎉',
      '🎊',
      '✅',
    ],
  },
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({ onEmojiSelect, className }: EmojiPickerProps) {
  const t = useTranslations('chat.emojiCategories');
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);

  const handleSelect = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('h-9 w-9', className)} aria-label="Emoji">
          <Smile className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" side="top" sideOffset={8}>
        <div className="p-2">
          {/* 分类选项卡 */}
          <div className="flex gap-1 mb-2 border-b pb-2">
            {EMOJI_CATEGORY_DATA.map((category, index) => (
              <Button
                key={category.key}
                variant="ghost"
                size="sm"
                className={cn('text-xs h-7 px-2', activeCategory === index && 'bg-muted')}
                onClick={() => setActiveCategory(index)}
              >
                {t(category.key)}
              </Button>
            ))}
          </div>

          {/* 表情网格 */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-7 gap-1"
            >
              {EMOJI_CATEGORY_DATA[activeCategory].emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleSelect(emoji)}
                  className="h-8 w-8 flex items-center justify-center text-xl hover:bg-muted rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </PopoverContent>
    </Popover>
  );
}
