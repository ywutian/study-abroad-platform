'use client';

import { forwardRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  GraduationCap,
  BookOpen,
  BarChart,
  Trophy,
  Calendar,
  CheckCircle2,
  Tag,
  MapPin,
  Users,
  DollarSign,
  Building2,
  Award,
  Briefcase,
  School,
} from 'lucide-react';

export interface SwipeCaseData {
  id: string;
  schoolName: string;
  schoolNameZh?: string;
  year: number;
  round?: string;
  major?: string;
  gpaRange?: string;
  satRange?: string;
  actRange?: string;
  toeflRange?: string;
  tags: string[];
  isVerified: boolean;
  usNewsRank?: number;
  acceptanceRate?: number;
  schoolState?: string;
  schoolCity?: string;
  graduationRate?: number;
  totalEnrollment?: number;
  tuition?: number;
  essayType?: string;
  isPrivateSchool?: boolean;
  // Applicant profile aggregates
  applicantGrade?: string;
  applicantSchoolType?: string;
  activityCount?: number;
  activityHighlights?: string[];
  awardCount?: number;
  highestAwardLevel?: string;
  apCount?: number;
}

interface SwipeCardProps {
  data: SwipeCaseData;
  onSwipe?: (direction: 'left' | 'right' | 'up' | 'down') => void;
  isTop?: boolean;
  className?: string;
}

interface InfoCardProps {
  label: string;
  value?: string;
  icon: React.ComponentType<{ className?: string }>;
}

function InfoCard({ label, value, icon: Icon }: InfoCardProps) {
  if (!value) return null;
  return (
    <div className="rounded-xl bg-muted/50 p-2.5 sm:p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
        <span className="text-2xs sm:text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-base sm:text-lg font-bold">{value}</p>
    </div>
  );
}

/** Velocity threshold for flick detection (px/s) */
const VELOCITY_THRESHOLD = 500;
/** Distance threshold for drag detection (px) */
const DRAG_THRESHOLD = 100;

export const SwipeCard = forwardRef<HTMLDivElement, SwipeCardProps>(
  ({ data, onSwipe, isTop = false, className }, ref) => {
    const t = useTranslations('hall.swipeCard');
    const locale = useLocale();
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-15, 15]);
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

    // Corner stamp opacities
    const rightStampOpacity = useTransform(x, [0, 80], [0, 1]);
    const leftStampOpacity = useTransform(x, [-80, 0], [1, 0]);
    const upStampOpacity = useTransform(y, [-80, 0], [1, 0]);
    const downStampOpacity = useTransform(y, [0, 80], [0, 1]);

    // Gradient tint on drag
    const greenTint = useTransform(x, [0, 150], [0, 0.15]);
    const redTint = useTransform(x, [-150, 0], [0.15, 0]);

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const vx = Math.abs(info.velocity.x);
      const vy = Math.abs(info.velocity.y);
      const isFlick = Math.max(vx, vy) > VELOCITY_THRESHOLD;
      const threshold = isFlick ? DRAG_THRESHOLD * 0.5 : DRAG_THRESHOLD;

      if (Math.abs(info.offset.x) > Math.abs(info.offset.y)) {
        if (info.offset.x > threshold) onSwipe?.('right');
        else if (info.offset.x < -threshold) onSwipe?.('left');
      } else {
        if (info.offset.y < -threshold) onSwipe?.('up');
        else if (info.offset.y > threshold) onSwipe?.('down');
      }
    };

    return (
      <motion.div
        ref={ref}
        className={cn('w-full max-w-md', 'cursor-grab active:cursor-grabbing', className)}
        style={{ x, y, rotate, opacity }}
        drag={isTop}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.7}
        onDragEnd={isTop ? handleDragEnd : undefined}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      >
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl',
            'bg-card/80 backdrop-blur-xl',
            'border border-border/50',
            'shadow-2xl',
            isTop && 'ring-2 ring-primary/20'
          )}
        >
          {/* Corner Stamp Overlays (replacing full-screen overlays) */}
          {isTop && (
            <>
              {/* Right - Admit stamp (top-right corner) */}
              <motion.div
                className="absolute top-4 right-4 z-10 pointer-events-none"
                style={{ opacity: rightStampOpacity }}
              >
                <div className="rounded-lg border-3 border-success bg-success/10 px-3 py-1.5 -rotate-12">
                  <span className="text-lg sm:text-xl font-black text-success uppercase tracking-wider">
                    {t('admitStamp')}
                  </span>
                </div>
              </motion.div>

              {/* Left - Reject stamp (top-left corner) */}
              <motion.div
                className="absolute top-4 left-4 z-10 pointer-events-none"
                style={{ opacity: leftStampOpacity }}
              >
                <div className="rounded-lg border-3 border-destructive bg-destructive/10 px-3 py-1.5 rotate-12">
                  <span className="text-lg sm:text-xl font-black text-destructive uppercase tracking-wider">
                    {t('rejectStamp')}
                  </span>
                </div>
              </motion.div>

              {/* Up - Waitlist stamp (top-center) */}
              <motion.div
                className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
                style={{ opacity: upStampOpacity }}
              >
                <div className="rounded-lg border-3 border-warning bg-warning/10 px-3 py-1.5">
                  <span className="text-lg sm:text-xl font-black text-warning uppercase tracking-wider">
                    {t('waitlistStamp')}
                  </span>
                </div>
              </motion.div>

              {/* Down - Skip stamp (bottom-center) */}
              <motion.div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
                style={{ opacity: downStampOpacity }}
              >
                <div className="rounded-lg border-3 border-muted-foreground bg-muted/40 px-3 py-1.5">
                  <span className="text-lg sm:text-xl font-black text-muted-foreground uppercase tracking-wider">
                    {t('skipStamp')}
                  </span>
                </div>
              </motion.div>

              {/* Gradient tint on drag */}
              <motion.div
                className="absolute inset-0 pointer-events-none z-[5] rounded-2xl"
                style={{
                  background: useTransform(
                    x,
                    [-150, 0, 150],
                    [
                      'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, transparent 50%)',
                      'transparent',
                      'linear-gradient(225deg, rgba(34,197,94,0.15) 0%, transparent 50%)',
                    ]
                  ),
                }}
              />
            </>
          )}

          {/* Top Gradient Bar */}
          <div className="h-1.5 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />

          {/* Card Content */}
          <div className="p-4 sm:p-5 space-y-3">
            {/* School Header */}
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 sm:h-13 sm:w-13 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-bold truncate leading-tight">
                  {getLocalizedName(data.schoolNameZh, data.schoolName, locale)}
                </h3>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  {data.usNewsRank && (
                    <Badge variant="outline" className="shrink-0 text-2xs px-1.5 py-0">
                      #{data.usNewsRank} US News
                    </Badge>
                  )}
                  {data.isPrivateSchool != null && (
                    <Badge variant="secondary" className="shrink-0 text-2xs px-1.5 py-0">
                      {data.isPrivateSchool ? t('privateSchool') : t('publicSchool')}
                    </Badge>
                  )}
                  {data.isVerified && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 shrink-0 text-2xs px-1.5 py-0">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                      {t('verified')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* School Quick Info Chips */}
            <div className="flex items-center gap-2 text-2xs sm:text-xs text-muted-foreground flex-wrap">
              {(data.schoolCity || data.schoolState) && (
                <div className="flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" />
                  <span>{[data.schoolCity, data.schoolState].filter(Boolean).join(', ')}</span>
                </div>
              )}
              {data.totalEnrollment && (
                <div className="flex items-center gap-0.5">
                  <Users className="h-3 w-3" />
                  <span>{data.totalEnrollment.toLocaleString()}</span>
                </div>
              )}
              {data.tuition && (
                <div className="flex items-center gap-0.5">
                  <DollarSign className="h-3 w-3" />
                  <span>${data.tuition.toLocaleString()}</span>
                </div>
              )}
              {data.graduationRate != null && (
                <div className="flex items-center gap-0.5">
                  <Building2 className="h-3 w-3" />
                  <span>
                    {t('graduationRate')} {data.graduationRate.toFixed(0)}%
                  </span>
                </div>
              )}
            </div>

            {/* Application Details */}
            <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{data.year}</span>
              </div>
              {data.round && (
                <Badge variant="secondary" className="text-2xs px-1.5 py-0">
                  {data.round}
                </Badge>
              )}
              {data.major && (
                <span className="truncate max-w-[120px] sm:max-w-[160px]">{data.major}</span>
              )}
              {data.essayType && (
                <Badge variant="outline" className="text-2xs px-1.5 py-0">
                  {data.essayType}
                </Badge>
              )}
            </div>

            {/* Applicant Stats Grid */}
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <InfoCard label="GPA" value={data.gpaRange} icon={BookOpen} />
              <InfoCard label="SAT" value={data.satRange} icon={BarChart} />
              <InfoCard label="ACT" value={data.actRange} icon={BarChart} />
              <InfoCard label="TOEFL" value={data.toeflRange} icon={Trophy} />
            </div>

            {/* Applicant Profile Summary */}
            {(data.activityCount || data.awardCount || data.apCount || data.applicantGrade) && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                  <Users className="h-2.5 w-2.5" />
                  <span>{t('applicantProfile')}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {/* Grade */}
                  {data.applicantGrade && (
                    <Badge variant="outline" className="text-2xs px-1.5 py-0 gap-0.5">
                      <School className="h-2.5 w-2.5" />
                      {t(`grade${data.applicantGrade}`)}
                    </Badge>
                  )}
                  {/* School type */}
                  {data.applicantSchoolType && (
                    <Badge variant="outline" className="text-2xs px-1.5 py-0">
                      {t(`schoolType${data.applicantSchoolType}`)}
                    </Badge>
                  )}
                  {/* Activities */}
                  {data.activityCount != null && data.activityCount > 0 && (
                    <Badge className="bg-blue-500/10 text-blue-600 text-2xs px-1.5 py-0 gap-0.5">
                      <Briefcase className="h-2.5 w-2.5" />
                      {t('activities', { count: data.activityCount })}
                    </Badge>
                  )}
                  {/* Awards */}
                  {data.awardCount != null && data.awardCount > 0 && (
                    <Badge className="bg-amber-500/10 text-amber-600 text-2xs px-1.5 py-0 gap-0.5">
                      <Award className="h-2.5 w-2.5" />
                      {t('awards', { count: data.awardCount })}
                    </Badge>
                  )}
                  {/* AP/IB */}
                  {data.apCount != null && data.apCount > 0 && (
                    <Badge className="bg-purple-500/10 text-purple-600 text-2xs px-1.5 py-0">
                      {t('apCourses', { count: data.apCount })}
                    </Badge>
                  )}
                  {/* Highest award level */}
                  {data.highestAwardLevel && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 text-2xs px-1.5 py-0 gap-0.5">
                      <Trophy className="h-2.5 w-2.5" />
                      {t(`awardLevel${data.highestAwardLevel}`)}
                    </Badge>
                  )}
                </div>
                {/* Activity category highlights */}
                {data.activityHighlights && data.activityHighlights.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {data.activityHighlights.map((cat) => (
                      <span
                        key={cat}
                        className="text-2xs text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5"
                      >
                        {t(`category${cat}`)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            {data.tags.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                  <Tag className="h-2.5 w-2.5" />
                  <span>{t('applicantFeatures')}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {data.tags.map((tag) => (
                    <Badge
                      key={tag}
                      className="bg-primary/10 text-primary hover:bg-primary/20 text-2xs px-1.5 py-0"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Acceptance Rate with progress bar */}
            {data.acceptanceRate != null && (
              <div className="pt-2 border-t border-border/50 space-y-1">
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-muted-foreground">{t('acceptanceRate')}</span>
                  <span className="font-semibold text-primary tabular-nums">
                    {data.acceptanceRate.toFixed(1)}%
                  </span>
                </div>
                <Progress value={data.acceptanceRate} className="h-1.5 [&>div]:bg-primary/60" />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);

SwipeCard.displayName = 'SwipeCard';
