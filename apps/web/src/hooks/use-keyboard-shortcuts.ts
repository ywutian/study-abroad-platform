'use client';

import { useEffect, useCallback, useRef } from 'react';

type Modifier = 'ctrl' | 'meta' | 'alt' | 'shift';

interface Shortcut {
  key: string;
  modifiers?: Modifier[];
  handler: (e: KeyboardEvent) => void;
  description?: string;
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  scope?: string;
}

/**
 * 键盘快捷键 Hook
 */
export function useKeyboardShortcuts(
  shortcuts: Shortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, scope } = options;
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 如果在输入框中，忽略快捷键（除非明确指定）
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    for (const shortcut of shortcutsRef.current) {
      const { key, modifiers = [], handler, preventDefault = true } = shortcut;

      // 检查按键是否匹配
      if (e.key.toLowerCase() !== key.toLowerCase()) continue;

      // 检查修饰键
      const ctrlOrMeta = modifiers.includes('ctrl') || modifiers.includes('meta');
      const needsCtrlOrMeta = ctrlOrMeta && (e.ctrlKey || e.metaKey);
      const needsAlt = modifiers.includes('alt') ? e.altKey : !e.altKey;
      const needsShift = modifiers.includes('shift') ? e.shiftKey : !e.shiftKey;

      const modifiersMatch =
        (ctrlOrMeta ? needsCtrlOrMeta : !e.ctrlKey && !e.metaKey) && needsAlt && needsShift;

      if (!modifiersMatch) continue;

      // 在输入框中时，只允许带修饰键的快捷键
      if (isInput && !ctrlOrMeta && !modifiers.includes('alt')) continue;

      if (preventDefault) {
        e.preventDefault();
      }

      handler(e);
      return;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

/**
 * 单个快捷键 Hook
 */
export function useHotkey(
  key: string,
  handler: (e: KeyboardEvent) => void,
  modifiers: Modifier[] = [],
  options: UseKeyboardShortcutsOptions = {}
) {
  useKeyboardShortcuts([{ key, modifiers, handler }], options);
}

/**
 * 获取快捷键显示文本
 */
export function getShortcutDisplay(key: string, modifiers: Modifier[] = []): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  const modifierSymbols: Record<Modifier, string> = isMac
    ? { ctrl: '⌃', meta: '⌘', alt: '⌥', shift: '⇧' }
    : { ctrl: 'Ctrl', meta: 'Win', alt: 'Alt', shift: 'Shift' };

  const parts = modifiers.map((m) => modifierSymbols[m]);
  parts.push(key.toUpperCase());

  return isMac ? parts.join('') : parts.join('+');
}

/**
 * 判断是否为 Mac 系统
 */
export function useIsMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}
