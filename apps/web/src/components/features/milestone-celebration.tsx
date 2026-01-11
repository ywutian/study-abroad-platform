'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Star,
  Sparkles,
  PartyPopper,
  Medal,
  Flame,
  Target,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type MilestoneType = 
  | 'profile_complete' 
  | 'first_prediction' 
  | 'first_essay' 
  | 'school_added' 
  | 'streak' 
  | 'level_up'
  | 'achievement';

interface MilestoneConfig {
  icon: React.ElementType;
  gradient: string;
  title: string;
  message: string;
}

const milestoneConfigs: Record<MilestoneType, MilestoneConfig> = {
  profile_complete: {
    icon: CheckCircle2,
    gradient: 'from-emerald-500 to-teal-500',
    title: '档案完善！',
    message: '太棒了！你已经完成了个人档案，AI 现在可以更好地为你推荐院校了。',
  },
  first_prediction: {
    icon: Target,
    gradient: 'from-blue-500 to-cyan-500',
    title: '首次预测！',
    message: '恭喜完成第一次录取预测！继续探索更多目标院校吧。',
  },
  first_essay: {
    icon: Sparkles,
    gradient: 'from-violet-500 to-purple-500',
    title: '文书起航！',
    message: '你的第一篇文书已创建！继续打磨，让招生官看到你的闪光点。',
  },
  school_added: {
    icon: Star,
    gradient: 'from-amber-500 to-orange-500',
    title: '目标确定！',
    message: '已添加新的目标院校！距离梦想又近了一步。',
  },
  streak: {
    icon: Flame,
    gradient: 'from-orange-500 to-red-500',
    title: '连续打卡！',
    message: '保持这份热情，坚持就是胜利！',
  },
  level_up: {
    icon: Medal,
    gradient: 'from-yellow-500 to-amber-500',
    title: '等级提升！',
    message: '你的努力得到了回报，继续加油！',
  },
  achievement: {
    icon: Trophy,
    gradient: 'from-rose-500 to-pink-500',
    title: '成就解锁！',
    message: '你解锁了一个新成就！继续探索更多。',
  },
};

interface MilestoneCelebrationProps {
  type?: MilestoneType;
  title?: string;
  description?: string;
  message?: string;
  show: boolean;
  onClose: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export function MilestoneCelebration({
  type = 'achievement',
  title,
  description,
  message,
  show,
  onClose,
  autoClose = true,
  autoCloseDelay = 5000,
}: MilestoneCelebrationProps) {
  const config = milestoneConfigs[type] || milestoneConfigs.achievement;
  const Icon = config.icon;
  const displayMessage = message || description;


  useEffect(() => {
    if (show && autoClose) {
      const timer = setTimeout(onClose, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [show, autoClose, autoCloseDelay, onClose]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* 背景遮罩 */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* CSS 烟花效果 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className={cn(
                  'absolute w-3 h-3 rounded-full',
                  i % 4 === 0 ? 'bg-amber-400' :
                  i % 4 === 1 ? 'bg-rose-400' :
                  i % 4 === 2 ? 'bg-emerald-400' : 'bg-blue-400'
                )}
                initial={{
                  x: '50%',
                  y: '50%',
                  scale: 0,
                  opacity: 1,
                }}
                animate={{
                  x: `${Math.random() * 100}%`,
                  y: `${Math.random() * 100}%`,
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 1.5,
                  delay: 0.3 + i * 0.05,
                  ease: 'easeOut',
                }}
              />
            ))}
          </div>

          {/* 内容卡片 */}
          <motion.div
            className="relative z-10 w-full max-w-sm"
            initial={{ scale: 0.8, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            <div className="relative overflow-hidden rounded-3xl bg-card border shadow-2xl">
              {/* 顶部渐变装饰 */}
              <div className={cn('h-2 bg-gradient-to-r', config.gradient)} />

              {/* 关闭按钮 */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-5 h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="p-6 text-center">
                {/* 图标动画 */}
                <motion.div
                  className={cn(
                    'mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-lg',
                    config.gradient
                  )}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: 'spring',
                    damping: 15,
                    stiffness: 200,
                    delay: 0.1,
                  }}
                >
                  <Icon className="h-10 w-10" />
                </motion.div>

                {/* 星星装饰 */}
                <motion.div
                  className="absolute left-8 top-20"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Sparkles className="h-6 w-6 text-amber-400" />
                </motion.div>
                <motion.div
                  className="absolute right-10 top-16"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                </motion.div>
                <motion.div
                  className="absolute right-6 top-28"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <PartyPopper className="h-5 w-5 text-rose-400" />
                </motion.div>

                {/* 标题 */}
                <motion.h3
                  className="text-2xl font-bold mb-2"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {title || config.title}
                </motion.h3>

                {/* 消息 */}
                <motion.p
                  className="text-muted-foreground leading-relaxed"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {displayMessage || config.message}
                </motion.p>

                {/* 继续按钮 */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Button
                    onClick={onClose}
                    className={cn(
                      'mt-6 px-8 bg-gradient-to-r text-white',
                      config.gradient
                    )}
                  >
                    继续前进 ✨
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook 用于触发里程碑庆祝
export function useMilestoneCelebration() {
  const [milestone, setMilestone] = useState<{
    type: MilestoneType;
    title?: string;
    message?: string;
  } | null>(null);

  const celebrate = useCallback((
    type: MilestoneType,
    options?: { title?: string; message?: string }
  ) => {
    setMilestone({ type, ...options });
  }, []);

  const close = useCallback(() => {
    setMilestone(null);
  }, []);

  return {
    milestone,
    celebrate,
    close,
    MilestoneCelebration: milestone ? (
      <MilestoneCelebration
        type={milestone.type}
        title={milestone.title}
        message={milestone.message}
        show={true}
        onClose={close}
      />
    ) : null,
  };
}

