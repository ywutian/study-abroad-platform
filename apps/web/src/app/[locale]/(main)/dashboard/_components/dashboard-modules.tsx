'use client';

import { Link } from '@/lib/i18n/navigation';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Search, FileCheck, Star, MessageCircle, ArrowRight } from 'lucide-react';

const mainModules = [
  {
    id: 'schools',
    href: '/schools',
    icon: Search,
    titleKey: 'dashboard.modules.schools',
    descKey: 'dashboard.modules.schoolsDesc',
    color: 'from-violet-500 to-purple-600',
    bgColor: 'bg-violet-500/10',
    iconColor: 'text-violet-500',
  },
  {
    id: 'uncommon-app',
    href: '/uncommon-app',
    icon: FileCheck,
    titleKey: 'dashboard.modules.uncommonApp',
    descKey: 'dashboard.modules.uncommonAppDesc',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
  },
  {
    id: 'feature-hall',
    href: '/hall',
    icon: Star,
    titleKey: 'dashboard.modules.featureHall',
    descKey: 'dashboard.modules.featureHallDesc',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
  },
  {
    id: 'forum',
    href: '/forum',
    icon: MessageCircle,
    titleKey: 'dashboard.modules.forum',
    descKey: 'dashboard.modules.forumDesc',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
  },
];

export function DashboardModules() {
  const t = useTranslations();
  return (
    <div>
      <h2 className="text-body-lg font-semibold mb-4">{t('dashboard.quickAccess')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <Card className="group h-full transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-primary/30 cursor-pointer">
                  {/* Gradient top border on hover */}
                  <div
                    className={cn(
                      'absolute top-0 left-0 right-0 h-1 rounded-t-lg bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity',
                      module.color
                    )}
                  />

                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          'w-12 h-12 rounded-lg flex items-center justify-center shrink-0',
                          module.bgColor
                        )}
                      >
                        <Icon className={cn('w-6 h-6', module.iconColor)} />
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

                    {/* Arrow indicator */}
                    <div className="mt-4 flex items-center justify-end text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
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
