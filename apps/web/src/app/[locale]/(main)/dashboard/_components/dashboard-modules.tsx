'use client';

import { Link } from '@/lib/i18n/navigation';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import {
  Search,
  TrendingUp,
  BookOpen,
  PenTool,
  Sparkles,
  MessageCircle,
  ArrowRight,
  FileText,
  Calendar,
} from 'lucide-react';

const mainModules = [
  {
    id: 'schools',
    href: '/schools',
    icon: Search,
    titleKey: 'dashboard.modules.schools',
    descKey: 'dashboard.modules.schoolsDesc',
  },
  {
    id: 'prediction',
    href: '/prediction',
    icon: TrendingUp,
    titleKey: 'dashboard.modules.prediction',
    descKey: 'dashboard.modules.predictionDesc',
  },
  {
    id: 'cases',
    href: '/cases',
    icon: BookOpen,
    titleKey: 'dashboard.modules.cases',
    descKey: 'dashboard.modules.casesDesc',
  },
  {
    id: 'essays',
    href: '/essays',
    icon: PenTool,
    titleKey: 'dashboard.modules.essays',
    descKey: 'dashboard.modules.essaysDesc',
  },
  {
    id: 'resume',
    href: '/resume',
    icon: FileText,
    titleKey: 'dashboard.modules.resume',
    descKey: 'dashboard.modules.resumeDesc',
  },
  {
    id: 'timeline',
    href: '/timeline',
    icon: Calendar,
    titleKey: 'dashboard.modules.timeline',
    descKey: 'dashboard.modules.timelineDesc',
  },
  {
    id: 'ai-assistant',
    href: '/ai',
    icon: Sparkles,
    titleKey: 'dashboard.modules.aiAssistant',
    descKey: 'dashboard.modules.aiAssistantDesc',
  },
  {
    id: 'forum',
    href: '/forum',
    icon: MessageCircle,
    titleKey: 'dashboard.modules.forum',
    descKey: 'dashboard.modules.forumDesc',
  },
];

export function DashboardModules() {
  const t = useTranslations();
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-body-lg font-semibold">{t('dashboard.quickAccess')}</h2>
        <span className="text-xs text-muted-foreground">
          {t('dashboard.commandCenter.secondary')}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {mainModules.map((module, index) => {
          const Icon = module.icon;
          return (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
            >
              <Link href={module.href}>
                <Card className="group h-full cursor-pointer transition-all duration-200 hover:border-primary/30 hover:shadow-[var(--theme-card-hover-shadow)]">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--theme-radius-button)] bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold group-hover:text-primary transition-colors">
                          {t(module.titleKey)}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {t(module.descKey)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end text-sm text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      <span>{t('common.enter')}</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
