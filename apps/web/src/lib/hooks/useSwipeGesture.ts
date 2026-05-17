'use client';

/**
 * useSwipeGesture — shared framer-motion drag primitive for Tinder-style cards.
 *
 * Provides the x/y motion values plus derived rotate/opacity transforms, and a
 * drag-end classifier that resolves a 3-direction intent (left / right / up)
 * together with a 0-100 confidence score derived from drag distance.
 *
 * Reused by SwipeCard (case deck) and the Hall review swipe wizard so the
 * gesture physics stay consistent across the app.
 */

import { useCallback } from 'react';
import { useMotionValue, useTransform, type PanInfo } from 'framer-motion';

export type SwipeDirection = 'left' | 'right' | 'up';

/** Distance (px) past which a drag commits to a direction. */
export const SWIPE_COMMIT_DISTANCE = 110;
/** Velocity (px/s) above which a short flick still commits. */
export const SWIPE_FLICK_VELOCITY = 480;
/** Drag distance (px) that maps to full (100) confidence. */
const SWIPE_CONFIDENCE_FULL = 240;

export interface SwipeGestureResult {
  direction: SwipeDirection;
  /** 0-100 confidence derived from how far the card was dragged. */
  confidence: number;
}

interface UseSwipeGestureOptions {
  /** Called once a drag/flick commits to a direction. */
  onSwipe: (result: SwipeGestureResult) => void;
}

/**
 * Map an absolute drag offset to a 1-100 confidence score.
 * A drag of SWIPE_COMMIT_DISTANCE → ~46; a full SWIPE_CONFIDENCE_FULL → 100.
 */
export function offsetToConfidence(offset: number): number {
  const ratio = Math.min(1, Math.abs(offset) / SWIPE_CONFIDENCE_FULL);
  return Math.max(1, Math.round(ratio * 100));
}

export function useSwipeGesture({ onSwipe }: UseSwipeGestureOptions) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const opacity = useTransform(
    x,
    [-220, -110, 0, 110, 220],
    [0.55, 1, 1, 1, 0.55]
  );

  const handleDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const vx = Math.abs(info.velocity.x);
      const vy = Math.abs(info.velocity.y);
      const isFlick = Math.max(vx, vy) > SWIPE_FLICK_VELOCITY;
      const threshold = isFlick
        ? SWIPE_COMMIT_DISTANCE * 0.5
        : SWIPE_COMMIT_DISTANCE;

      const { x: ox, y: oy } = info.offset;

      // Up is a vertical-dominant gesture; left/right are horizontal-dominant.
      if (-oy > Math.abs(ox) && -oy > threshold) {
        onSwipe({ direction: 'up', confidence: offsetToConfidence(oy) });
        return;
      }
      if (ox > threshold) {
        onSwipe({ direction: 'right', confidence: offsetToConfidence(ox) });
        return;
      }
      if (ox < -threshold) {
        onSwipe({ direction: 'left', confidence: offsetToConfidence(ox) });
      }
    },
    [onSwipe]
  );

  return { x, y, rotate, opacity, handleDragEnd };
}
