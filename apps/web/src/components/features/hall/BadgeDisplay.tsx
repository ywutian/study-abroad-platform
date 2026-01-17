'use client';

import { motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { Shield, Crown, Gem, Award } from 'lucide-react';

export type SwipeBadge = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

interface BadgeConfig {
  color: string;
  bgColor: string;
  glowColor: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Translation key under hall.badges namespace */
  key: SwipeBadge;
}

const BADGE_CONFIG: Record<SwipeBadge, BadgeConfig> = {
  bronze: {
    color: 'text-amber-700',
    bgColor: 'from-amber-600 to-amber-800',
    glowColor: 'shadow-amber-500/30',
    icon: Shield,
    key: 'bronze',
  },
  silver: {
    color: 'text-gray-500',
    bgColor: 'from-gray-300 to-gray-500',
    glowColor: 'shadow-gray-400/30',
    icon: Shield,
    key: 'silver',
  },
  gold: {
    color: 'text-yellow-500',
    bgColor: 'from-yellow-400 to-amber-500',
    glowColor: 'shadow-yellow-400/40',
    icon: Crown,
    key: 'gold',
  },
  platinum: {
    color: 'text-cyan-500',
    bgColor: 'from-cyan-300 to-blue-500',
    glowColor: 'shadow-cyan-400/40',
    icon: Award,
    key: 'platinum',
  },
  diamond: {
    color: 'text-violet-500',
    bgColor: 'from-violet-400 to-purple-600',
    glowColor: 'shadow-violet-400/50',
    icon: Gem,
    key: 'diamond',
  },
};

interface BadgeDisplayProps {
  badge: SwipeBadge;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

export function BadgeDisplay({
  badge,
  size = 'md',
  showLabel = false,
  animated = true,
  className,
}: BadgeDisplayProps) {
  const t = useTranslations('hall');
  const config = BADGE_CONFIG[badge];
  const BadgeIcon = config.icon;
  const badgeLabel = t(`badges.${config.key}`);

  const sizeClasses = {
    sm: 'h-10 w-10',
    md: 'h-16 w-16',
    lg: 'h-24 w-24',
  };

  const iconSizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const BadgeContent = (
    <div
      className={cn(
        'relative inline-flex items-center justify-center',
        'rounded-full',
        'bg-gradient-to-br shadow-lg',
        sizeClasses[size],
        config.bgColor,
        config.glowColor,
        className
      )}
    >
      <BadgeIcon className={cn(iconSizeClasses[size], 'text-white')} />
      {/* Glow effect */}
      {animated && (
        <div
          className={cn(
            'absolute inset-0 rounded-full',
            'animate-pulse opacity-50',
            config.glowColor
          )}
        />
      )}
    </div>
  );

  if (animated) {
    return (
      <div className="flex flex-col items-center gap-2">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200 }}
        >
          {BadgeContent}
        </motion.div>
        {showLabel && (
          <motion.span
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn('text-sm font-semibold', config.color)}
          >
            {badgeLabel}
          </motion.span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {BadgeContent}
      {showLabel && <span className={cn('text-sm font-semibold', config.color)}>{badgeLabel}</span>}
    </div>
  );
}

// Badge progress component
interface BadgeProgressProps {
  currentBadge: SwipeBadge;
  correctCount: number;
  toNextBadge: number;
}

const BADGE_THRESHOLDS: Record<SwipeBadge, number> = {
  bronze: 0,
  silver: 20,
  gold: 50,
  platinum: 100,
  diamond: 200,
};

export function BadgeProgress({ currentBadge, correctCount, toNextBadge }: BadgeProgressProps) {
  const t = useTranslations('hall');
  const badges: SwipeBadge[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const currentIndex = badges.indexOf(currentBadge);
  const nextBadge = currentIndex < badges.length - 1 ? badges[currentIndex + 1] : null;

  const progress = nextBadge
    ? ((correctCount - BADGE_THRESHOLDS[currentBadge]) /
        (BADGE_THRESHOLDS[nextBadge] - BADGE_THRESHOLDS[currentBadge])) *
      100
    : 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <BadgeDisplay badge={currentBadge} size="sm" />
        {nextBadge && (
          <>
            <div className="flex-1 mx-3 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  'h-full rounded-full bg-gradient-to-r',
                  BADGE_CONFIG[currentBadge].bgColor
                )}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <BadgeDisplay badge={nextBadge} size="sm" animated={false} />
          </>
        )}
      </div>
      {nextBadge && (
        <p className="text-center text-sm text-muted-foreground">
          {t('badgeProgress', {
            count: toNextBadge,
            badge: t(`badges.${nextBadge}`),
          })}
        </p>
      )}
    </div>
  );
}
