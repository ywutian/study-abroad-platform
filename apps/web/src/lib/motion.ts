/**
 * 动画配置中心 - Framer Motion 预设
 */

import { Variants, Transition } from 'framer-motion';

// ============================================
// 过渡配置
// ============================================

export const transitions = {
  // 弹性过渡
  spring: {
    type: 'spring',
    stiffness: 400,
    damping: 30,
  } as Transition,

  // 柔和弹性
  springGentle: {
    type: 'spring',
    stiffness: 200,
    damping: 25,
  } as Transition,

  // 快速弹性
  springSnappy: {
    type: 'spring',
    stiffness: 500,
    damping: 35,
  } as Transition,

  // 缓出
  easeOut: {
    type: 'tween',
    ease: [0.16, 1, 0.3, 1],
    duration: 0.4,
  } as Transition,

  // 快速缓出
  easeOutFast: {
    type: 'tween',
    ease: [0.16, 1, 0.3, 1],
    duration: 0.2,
  } as Transition,

  // 慢速缓出
  easeOutSlow: {
    type: 'tween',
    ease: [0.16, 1, 0.3, 1],
    duration: 0.6,
  } as Transition,
};

// ============================================
// 页面过渡
// ============================================

export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: transitions.easeOut,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: transitions.easeOutFast,
  },
};

export const pageSlideVariants: Variants = {
  initial: {
    opacity: 0,
    x: 20,
  },
  enter: {
    opacity: 1,
    x: 0,
    transition: transitions.easeOut,
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: transitions.easeOutFast,
  },
};

// ============================================
// 列表动画（Staggered）
// ============================================

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: transitions.springGentle,
  },
};

export const staggerItemScale: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: {
    opacity: 1,
    scale: 1,
    transition: transitions.spring,
  },
};

export const staggerItemSlide: Variants = {
  hidden: { opacity: 0, x: -16 },
  show: {
    opacity: 1,
    x: 0,
    transition: transitions.springGentle,
  },
};

// ============================================
// 渐入动画
// ============================================

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: transitions.easeOut,
  },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.springGentle,
  },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.springGentle,
  },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.springGentle,
  },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.springGentle,
  },
};

// ============================================
// 缩放动画
// ============================================

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.spring,
  },
};

export const scaleInBounce: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
    },
  },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.springSnappy,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: transitions.easeOutFast,
  },
};

// ============================================
// 消息/聊天动画
// ============================================

export const messageIn: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitions.springGentle,
  },
};

export const messageInLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.springGentle,
  },
};

export const messageInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.springGentle,
  },
};

export const typingDots: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      repeat: Infinity,
      repeatDelay: 0.5,
    },
  },
};

export const typingDot: Variants = {
  hidden: { y: 0 },
  visible: {
    y: [-2, 2, -2],
    transition: {
      duration: 0.6,
      repeat: Infinity,
    },
  },
};

// ============================================
// 卡片动画
// ============================================

export const cardHover = {
  rest: {
    scale: 1,
    y: 0,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  hover: {
    scale: 1.02,
    y: -4,
    boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
    transition: transitions.spring,
  },
  tap: {
    scale: 0.98,
    transition: transitions.springSnappy,
  },
};

export const card3DHover = {
  rest: {
    rotateX: 0,
    rotateY: 0,
    scale: 1,
  },
  hover: {
    scale: 1.02,
    transition: transitions.spring,
  },
};

// ============================================
// 按钮动画
// ============================================

export const buttonTap = {
  scale: 0.96,
  transition: transitions.springSnappy,
};

export const buttonHover = {
  scale: 1.02,
  transition: transitions.spring,
};

// ============================================
// 进度/加载动画
// ============================================

export const progressFill: Variants = {
  hidden: { width: 0 },
  visible: (custom: number) => ({
    width: `${custom}%`,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 20,
      delay: 0.2,
    },
  }),
};

export const shimmer: Variants = {
  hidden: { x: '-100%' },
  visible: {
    x: '100%',
    transition: {
      repeat: Infinity,
      duration: 1.5,
      ease: 'linear',
    },
  },
};

export const pulse: Variants = {
  hidden: { opacity: 0.5 },
  visible: {
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const spin: Variants = {
  hidden: { rotate: 0 },
  visible: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// ============================================
// 展开/收起
// ============================================

export const expandCollapse: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: transitions.easeOutFast,
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: transitions.springGentle,
  },
};

// ============================================
// 数字计数动画配置
// ============================================

export const countUpConfig = {
  duration: 1.5,
  useEasing: true,
  separator: ',',
};

// ============================================
// 工具函数
// ============================================

/**
 * 创建延迟动画
 */
export const withDelay = (variants: Variants, delay: number): Variants => {
  const result: Variants = {};
  for (const key in variants) {
    const variant = variants[key];
    if (typeof variant === 'object' && variant !== null) {
      result[key] = {
        ...variant,
        transition: {
          ...(variant as any).transition,
          delay,
        },
      };
    }
  }
  return result;
};

/**
 * 创建索引延迟（用于列表项）
 */
export const withIndexDelay = (index: number, baseDelay: number = 0.05) => ({
  transition: { delay: index * baseDelay },
});









