'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface ScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  disabled?: boolean;
}

const defaultOptions: ScrollAnimationOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px',
  triggerOnce: true,
  disabled: false,
};

/**
 * 滚动触发动画 Hook
 */
export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(
  options: ScrollAnimationOptions = {}
) {
  const { threshold, rootMargin, triggerOnce, disabled } = {
    ...defaultOptions,
    ...options,
  };

  const ref = useRef<T>(null);
  const [isInView, setIsInView] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (disabled || !ref.current) return;

    // 检查用户是否偏好减少动画
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
      setIsInView(true);
      setHasAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          setHasAnimated(true);
          if (triggerOnce) {
            observer.disconnect();
          }
        } else if (!triggerOnce) {
          setIsInView(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce, disabled]);

  return { ref, isInView, hasAnimated };
}

/**
 * 批量滚动动画 Hook - 用于列表
 */
export function useScrollAnimationList(
  count: number,
  options: ScrollAnimationOptions = {}
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!containerRef.current) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
      setVisibleItems(new Set(Array.from({ length: count }, (_, i) => i)));
      return;
    }

    const children = containerRef.current.children;
    const observers: IntersectionObserver[] = [];

    Array.from(children).forEach((child, index) => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisibleItems((prev) => new Set([...prev, index]));
            if (options.triggerOnce !== false) {
              observer.disconnect();
            }
          }
        },
        {
          threshold: options.threshold ?? 0.1,
          rootMargin: options.rootMargin ?? '0px 0px -30px 0px',
        }
      );

      observer.observe(child);
      observers.push(observer);
    });

    return () => observers.forEach((obs) => obs.disconnect());
  }, [count, options.threshold, options.rootMargin, options.triggerOnce]);

  const isVisible = useCallback(
    (index: number) => visibleItems.has(index),
    [visibleItems]
  );

  return { containerRef, isVisible, visibleItems };
}



