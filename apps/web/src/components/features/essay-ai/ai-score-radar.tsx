'use client';

/**
 * AI 评分雷达图组件
 * 用于展示文书 AI 评审的多维度评分
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface ScoreDimension {
  key: string;
  label: string;
  score: number;
  maxScore?: number;
  feedback?: string;
}

interface AIScoreRadarProps {
  scores: ScoreDimension[];
  overallScore?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  showValues?: boolean;
  animated?: boolean;
  className?: string;
}

export function AIScoreRadar({
  scores,
  overallScore,
  size = 'md',
  showLabels = true,
  showValues = true,
  animated = true,
  className,
}: AIScoreRadarProps) {
  const t = useTranslations('essayAi');

  const dimensions = {
    sm: { width: 200, height: 200, radius: 70 },
    md: { width: 280, height: 280, radius: 100 },
    lg: { width: 360, height: 360, radius: 130 },
  };

  const { width, height, radius } = dimensions[size];
  const centerX = width / 2;
  const centerY = height / 2;

  // 计算多边形顶点
  const points = useMemo(() => {
    const angleStep = (2 * Math.PI) / scores.length;
    return scores.map((score, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const normalizedScore = (score.score / (score.maxScore || 10)) * radius;
      return {
        x: centerX + normalizedScore * Math.cos(angle),
        y: centerY + normalizedScore * Math.sin(angle),
        labelX: centerX + (radius + 25) * Math.cos(angle),
        labelY: centerY + (radius + 25) * Math.sin(angle),
        ...score,
      };
    });
  }, [scores, centerX, centerY, radius]);

  // 生成多边形路径
  const polygonPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  // 生成背景网格
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1];
  const gridPaths = gridLevels.map((level) => {
    const r = radius * level;
    const angleStep = (2 * Math.PI) / scores.length;
    return (
      scores
        .map((_, index) => {
          const angle = angleStep * index - Math.PI / 2;
          return {
            x: centerX + r * Math.cos(angle),
            y: centerY + r * Math.sin(angle),
          };
        })
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
        .join(' ') + ' Z'
    );
  });

  // 生成轴线
  const axisLines = scores.map((_, index) => {
    const angle = ((2 * Math.PI) / scores.length) * index - Math.PI / 2;
    return {
      x1: centerX,
      y1: centerY,
      x2: centerX + radius * Math.cos(angle),
      y2: centerY + radius * Math.sin(angle),
    };
  });

  // 计算平均分
  const avgScore = useMemo(() => {
    if (overallScore !== undefined) return overallScore;
    const sum = scores.reduce((acc, s) => acc + s.score, 0);
    return sum / scores.length;
  }, [scores, overallScore]);

  // 获取评分等级
  const getScoreLevel = (score: number) => {
    if (score >= 9)
      return { label: t('scoreExcellent'), color: 'text-emerald-500', bg: 'bg-emerald-500' };
    if (score >= 7) return { label: t('scoreGood'), color: 'text-blue-500', bg: 'bg-blue-500' };
    if (score >= 5)
      return { label: t('scoreAverage'), color: 'text-amber-500', bg: 'bg-amber-500' };
    return { label: t('scoreNeedsWork'), color: 'text-red-500', bg: 'bg-red-500' };
  };

  const scoreLevel = getScoreLevel(avgScore);

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* 总分显示 */}
      <motion.div
        className="text-center"
        initial={animated ? { opacity: 0, y: -10 } : {}}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <Star className={cn('h-5 w-5', scoreLevel.color)} />
          <span className={cn('text-3xl font-bold', scoreLevel.color)}>{avgScore.toFixed(1)}</span>
          <span className="text-muted-foreground text-sm">/10</span>
        </div>
        <div
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white',
            scoreLevel.bg
          )}
        >
          {scoreLevel.label}
        </div>
      </motion.div>

      {/* 雷达图 */}
      <div className="relative">
        <svg width={width} height={height} className="overflow-visible">
          {/* 背景网格 */}
          {gridPaths.map((path, index) => (
            <motion.path
              key={`grid-${index}`}
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-border/40"
              initial={animated ? { opacity: 0 } : {}}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.05 }}
            />
          ))}

          {/* 轴线 */}
          {axisLines.map((line, index) => (
            <motion.line
              key={`axis-${index}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="currentColor"
              strokeWidth="1"
              className="text-border/60"
              initial={animated ? { opacity: 0 } : {}}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + index * 0.02 }}
            />
          ))}

          {/* 数据区域 */}
          <motion.path
            d={polygonPath}
            fill="url(#radarGradient)"
            stroke="url(#radarStroke)"
            strokeWidth="2"
            initial={animated ? { opacity: 0, scale: 0.5 } : {}}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 100 }}
            style={{ transformOrigin: `${centerX}px ${centerY}px` }}
          />

          {/* 数据点 */}
          {points.map((point, index) => (
            <motion.circle
              key={`point-${index}`}
              cx={point.x}
              cy={point.y}
              r="5"
              className="fill-primary stroke-background"
              strokeWidth="2"
              initial={animated ? { opacity: 0, scale: 0 } : {}}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + index * 0.05 }}
            />
          ))}

          {/* 渐变定义 */}
          <defs>
            <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
            </linearGradient>
          </defs>
        </svg>

        {/* 标签 */}
        {showLabels &&
          points.map((point, index) => (
            <motion.div
              key={`label-${index}`}
              className="absolute whitespace-nowrap text-center"
              style={{
                left: point.labelX,
                top: point.labelY,
                transform: 'translate(-50%, -50%)',
              }}
              initial={animated ? { opacity: 0 } : {}}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + index * 0.05 }}
            >
              <div className="text-xs font-medium text-foreground">{point.label}</div>
              {showValues && (
                <div className={cn('text-sm font-bold', getScoreLevel(point.score).color)}>
                  {point.score.toFixed(1)}
                </div>
              )}
            </motion.div>
          ))}
      </div>
    </div>
  );
}

// 分数详情列表组件
interface ScoreDetailListProps {
  scores: ScoreDimension[];
  className?: string;
}

export function ScoreDetailList({ scores, className }: ScoreDetailListProps) {
  const getTrend = (score: number) => {
    if (score >= 8) return { icon: TrendingUp, color: 'text-emerald-500' };
    if (score >= 5) return { icon: Minus, color: 'text-amber-500' };
    return { icon: TrendingDown, color: 'text-red-500' };
  };

  return (
    <div className={cn('space-y-3', className)}>
      {scores.map((score, index) => {
        const trend = getTrend(score.score);
        const TrendIcon = trend.icon;
        const percentage = (score.score / (score.maxScore || 10)) * 100;

        return (
          <motion.div
            key={score.key}
            className="space-y-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendIcon className={cn('h-4 w-4', trend.color)} />
                <span className="text-sm font-medium">{score.label}</span>
              </div>
              <span className={cn('text-sm font-bold', trend.color)}>
                {score.score.toFixed(1)}/{score.maxScore || 10}
              </span>
            </div>

            {/* 进度条 */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  score.score >= 8
                    ? 'bg-success'
                    : score.score >= 5
                      ? 'bg-warning'
                      : 'bg-destructive'
                )}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ delay: 0.2 + index * 0.05, duration: 0.5 }}
              />
            </div>

            {/* 反馈 */}
            {score.feedback && (
              <p className="text-xs text-muted-foreground pl-6">{score.feedback}</p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// 紧凑型评分徽章
interface ScoreBadgeProps {
  score: number;
  maxScore?: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ScoreBadge({
  score,
  maxScore = 10,
  label,
  size = 'md',
  className,
}: ScoreBadgeProps) {
  const percentage = (score / maxScore) * 100;

  const getColor = () => {
    if (percentage >= 80) return 'from-emerald-500 to-emerald-400 text-white';
    if (percentage >= 60) return 'from-blue-500 to-blue-400 text-white';
    if (percentage >= 40) return 'from-amber-500 to-amber-400 text-white';
    return 'from-red-500 to-red-400 text-white';
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold bg-gradient-to-r',
        getColor(),
        sizes[size],
        className
      )}
    >
      {label && <span className="opacity-90">{label}</span>}
      <span>{score.toFixed(1)}</span>
    </div>
  );
}
