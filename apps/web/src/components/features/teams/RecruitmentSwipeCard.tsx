'use client';

import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Clock3, Globe, MapPin, Wifi, Users, Sparkles } from 'lucide-react';
import type { TeamRecruitmentCardFrontDto } from '@study-abroad/shared';
import { getRecruitmentContextLabel, getRecruitmentContextMeta } from './team-recruitment-utils';
import { CardQualityPill, TrustBadge } from './TrustBadge';

const VELOCITY_THRESHOLD = 500;
const DRAG_THRESHOLD = 100;

interface RecruitmentSwipeCardProps {
  card: TeamRecruitmentCardFrontDto;
  onSwipe?: (direction: 'left' | 'right') => void;
  isTop?: boolean;
  className?: string;
}

const COLLAB_ICON = { ONLINE: Wifi, OFFLINE: MapPin, HYBRID: Globe };

export const RecruitmentSwipeCard = forwardRef<HTMLDivElement, RecruitmentSwipeCardProps>(
  ({ card, onSwipe, isTop = false, className }, ref) => {
    const t = useTranslations('teams.recruitment');
    const locale = useLocale();
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-12, 12]);
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

    // Stamp opacities
    const likeStampOpacity = useTransform(x, [0, 80], [0, 1]);
    const passStampOpacity = useTransform(x, [-80, 0], [1, 0]);

    // Gradient tint
    const likeOverlay = useTransform(x, [0, 120], [0, 0.15]);
    const passOverlay = useTransform(x, [-120, 0], [0.15, 0]);

    const handleDragEnd = (_: unknown, info: PanInfo) => {
      if (!onSwipe) return;
      const { velocity, offset } = info;

      if (velocity.x > VELOCITY_THRESHOLD || offset.x > DRAG_THRESHOLD) {
        onSwipe('right');
      } else if (velocity.x < -VELOCITY_THRESHOLD || offset.x < -DRAG_THRESHOLD) {
        onSwipe('left');
      }
    };

    const CollabIcon = card.collaborationMode
      ? COLLAB_ICON[card.collaborationMode] || Globe
      : Globe;

    const isNetworking = card.intentMode === 'NETWORKING_ONLY';
    const contextLabel = getRecruitmentContextLabel(card, locale);
    const contextMeta = getRecruitmentContextMeta(card, locale);

    return (
      <motion.div
        ref={ref}
        className={cn(
          'relative select-none touch-none',
          isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none',
          className
        )}
        style={isTop ? { x, rotate, opacity } : undefined}
        drag={isTop ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={isTop ? handleDragEnd : undefined}
        whileTap={isTop ? { scale: 0.98 } : undefined}
      >
        {/* LIKE stamp */}
        {isTop && (
          <motion.div
            className="absolute top-6 right-6 z-10 rotate-12 border-4 border-green-500 rounded-lg px-4 py-1"
            style={{ opacity: likeStampOpacity }}
          >
            <span className="text-2xl font-black text-green-500 tracking-wider">LIKE</span>
          </motion.div>
        )}

        {/* PASS stamp */}
        {isTop && (
          <motion.div
            className="absolute top-6 left-6 z-10 -rotate-12 border-4 border-red-500 rounded-lg px-4 py-1"
            style={{ opacity: passStampOpacity }}
          >
            <span className="text-2xl font-black text-red-500 tracking-wider">PASS</span>
          </motion.div>
        )}

        {/* Card body */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-border/60 bg-card shadow-lg">
          {/* Green / Red overlay */}
          {isTop && (
            <>
              <motion.div
                className="absolute inset-0 bg-green-500 pointer-events-none z-[1] rounded-2xl"
                style={{ opacity: likeOverlay }}
              />
              <motion.div
                className="absolute inset-0 bg-red-500 pointer-events-none z-[1] rounded-2xl"
                style={{ opacity: passOverlay }}
              />
            </>
          )}

          {/* Top gradient bar */}
          <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

          {/* Header */}
          <div className="p-5 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {contextMeta ? (
                  <p className="text-xs uppercase tracking-wide text-muted-foreground truncate">
                    {contextMeta}
                  </p>
                ) : null}
                {contextLabel ? (
                  <p className="mt-1 truncate text-sm font-medium text-foreground/80">
                    {contextLabel}
                  </p>
                ) : null}
                <h3 className="text-xl font-bold mt-1 truncate">{card.team.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{card.headline}</p>
                {card.qualitySignal === 'thin' ? (
                  <div className="mt-1.5">
                    <CardQualityPill signal={card.qualitySignal} />
                  </div>
                ) : null}
              </div>
              <Badge
                variant={isNetworking ? 'secondary' : 'default'}
                className={cn(
                  'shrink-0',
                  !isNetworking &&
                    'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0'
                )}
              >
                {isNetworking ? t('intentMode.networkingOnly') : card.status}
              </Badge>
            </div>

            {card.highlightTitle && (
              <div className="mt-2">
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400"
                >
                  <Sparkles className="h-3 w-3" />
                  {card.highlightTitle}
                </Badge>
              </div>
            )}
          </div>

          {/* Meta badges */}
          <div className="px-5 flex flex-wrap gap-1.5">
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {card.team.currentSize}/{card.team.targetSize}
            </Badge>
            {card.availabilityBand && (
              <Badge variant="outline" className="gap-1">
                <Clock3 className="h-3 w-3" />
                {t(`availability.${card.availabilityBand}`)}
              </Badge>
            )}
            {card.collaborationMode && (
              <Badge variant="outline" className="gap-1">
                <CollabIcon className="h-3 w-3" />
                {t(`option.${card.collaborationMode.toLowerCase()}`)}
              </Badge>
            )}
            {card.city && (
              <Badge variant="outline" className="gap-1">
                <MapPin className="h-3 w-3" />
                {card.city}
              </Badge>
            )}
          </div>

          {/* Roles & Skills */}
          <div className="p-5 pt-3 space-y-3">
            {card.offerRoles.length > 0 && (
              <RoleBlock label={t('card.offer')} items={card.offerRoles} variant="green" />
            )}
            {card.needRoles.length > 0 && (
              <RoleBlock label={t('card.need')} items={card.needRoles} variant="orange" />
            )}
            {card.skillTags.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  {t('card.skills')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {card.skillTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Detail note */}
          {card.detailNote ? (
            <RecruitmentDetailNote cardId={card.id} text={card.detailNote} />
          ) : null}

          {/* Members preview */}
          {card.members.length > 0 && (
            <div className="px-5 pb-5">
              <div className="flex flex-wrap items-center gap-2">
                {card.members.slice(0, 3).map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1"
                  >
                    <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-2xs font-bold text-primary shrink-0">
                      {(m.displayName || '?')[0]}
                    </div>
                    <span className="text-xs font-medium truncate max-w-[80px]">
                      {m.displayName || m.role}
                    </span>
                    <TrustBadge level={m.verificationLevel} />
                    {m.school ? (
                      <span className="text-2xs text-muted-foreground truncate max-w-[90px] border-l border-border pl-1.5">
                        {m.school}
                      </span>
                    ) : null}
                  </div>
                ))}
                {card.members.length > 3 && (
                  <span className="text-xs text-muted-foreground">+{card.members.length - 3}</span>
                )}
              </div>
            </div>
          )}

          {/* Languages bar */}
          {card.languages.length > 0 && (
            <div className="border-t px-5 py-2.5 flex items-center gap-2">
              <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">{card.languages.join(' · ')}</span>
            </div>
          )}
        </div>
      </motion.div>
    );
  }
);

RecruitmentSwipeCard.displayName = 'RecruitmentSwipeCard';

function RecruitmentDetailNote({ cardId, text }: { cardId: string; text: string }) {
  const t = useTranslations('teams.recruitment');
  const [expanded, setExpanded] = useState(false);
  const [isTruncatable, setIsTruncatable] = useState(false);
  const paragraphRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setExpanded(false);
  }, [cardId]);

  useLayoutEffect(() => {
    if (expanded) return;
    const el = paragraphRef.current;
    if (!el) return;
    setIsTruncatable(el.scrollHeight > el.clientHeight + 2);
  }, [cardId, text, expanded]);

  return (
    <div className="px-5 pb-4">
      <div className="rounded-xl bg-muted/50 p-3 overflow-hidden">
        <p
          ref={paragraphRef}
          className={cn(
            'text-sm text-muted-foreground break-words m-0',
            expanded ? 'whitespace-pre-line' : 'line-clamp-5'
          )}
        >
          {text}
        </p>
        {isTruncatable ? (
          <button
            type="button"
            className="mt-1.5 text-xs font-medium text-primary underline-offset-2 hover:underline"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? t('card.detailCollapse') : t('card.detailExpand')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RoleBlock({
  label,
  items,
  variant,
}: {
  label: string;
  items: string[];
  variant: 'green' | 'orange';
}) {
  const colors =
    variant === 'green'
      ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
      : 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400';

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', colors)}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
