/**
 * Centralized animation configuration hook
 * Respects user's reduced motion preference
 */

import { useReducedMotion } from 'react-native-reanimated';
import { animation } from '@/utils/theme';

export function useAnimationConfig() {
  const reducedMotion = useReducedMotion();

  return {
    reducedMotion: !!reducedMotion,
    duration: reducedMotion
      ? { instant: 0, fast: 0, normal: 0, slow: 0, slower: 0 }
      : animation.duration,
    spring: reducedMotion
      ? {
          gentle: { damping: 100, stiffness: 500, mass: 1 },
          default: { damping: 100, stiffness: 500, mass: 1 },
          snappy: { damping: 100, stiffness: 500, mass: 1 },
          bouncy: { damping: 100, stiffness: 500, mass: 1 },
          quick: { damping: 100, stiffness: 500, mass: 1 },
        }
      : animation.spring,
    pressScale: reducedMotion ? { button: 1, card: 1, icon: 1, tab: 1 } : animation.pressScale,
    shouldAnimate: !reducedMotion,
  };
}
