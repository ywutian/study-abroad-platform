'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  FileText,
  Calendar,
  Shield,
  Users,
  AlertTriangle,
  Scale,
  Mail,
  ScrollText,
} from 'lucide-react';

import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const sections = [
  {
    id: 'acceptance',
    icon: FileText,
    titleKey: 'acceptance.title',
    contentKey: 'acceptance.content',
    color: 'blue',
  },
  {
    id: 'services',
    icon: Users,
    titleKey: 'services.title',
    contentKey: 'services.content',
    color: 'emerald',
  },
  {
    id: 'userConduct',
    icon: Shield,
    titleKey: 'userConduct.title',
    contentKey: 'userConduct.content',
    color: 'violet',
  },
  {
    id: 'intellectualProperty',
    icon: Scale,
    titleKey: 'intellectualProperty.title',
    contentKey: 'intellectualProperty.content',
    color: 'amber',
  },
  {
    id: 'disclaimer',
    icon: AlertTriangle,
    titleKey: 'disclaimer.title',
    contentKey: 'disclaimer.content',
    color: 'rose',
  },
  {
    id: 'termination',
    icon: Calendar,
    titleKey: 'termination.title',
    contentKey: 'termination.content',
    color: 'slate',
  },
];

const colorMap: Record<string, { bg: string; text: string; gradient: string }> = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-500', gradient: 'bg-primary' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', gradient: 'bg-success' },
  violet: { bg: 'bg-primary/10', text: 'text-primary', gradient: 'bg-primary' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', gradient: 'bg-warning' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-500', gradient: 'bg-destructive' },
  slate: { bg: 'bg-muted', text: 'text-muted-foreground', gradient: 'from-slate-500 to-gray-500' },
};

export default function TermsPage() {
  const t = useTranslations('terms');

  return (
    <PageContainer maxWidth="4xl">
      <PageHeader
        title={t('title')}
        description={t('lastUpdated', { date: '2026-01-01' })}
        icon={ScrollText}
        color="slate"
      />

      {/* Introduction */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="mb-8 overflow-hidden">
          <div className="h-1 bg-slate-500" />
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <Badge variant="secondary" className="mb-2">
                  {t('importantBadge')}
                </Badge>
                <p className="text-muted-foreground leading-relaxed">{t('introduction')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, index) => {
          const Icon = section.icon;
          const colors = colorMap[section.color];
          return (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
            >
              <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <div className={cn('h-1 bg-gradient-to-r', colors.gradient)} />
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg',
                        colors.bg
                      )}
                    >
                      <Icon className={cn('h-4 w-4', colors.text)} />
                    </div>
                    <span className="flex-1">{t(section.titleKey)}</span>
                    <Badge variant="outline" className="text-xs font-normal">
                      {t('sectionNumber', { num: index + 1 })}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line pl-12">
                    {t(section.contentKey)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Contact */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-8"
      >
        <Card className="overflow-hidden">
          <div className="h-1 bg-primary" />
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                <Mail className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">{t('contact.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('contact.content')}</p>
              </div>
            </div>
            <Button variant="outline" className="gap-2" asChild>
              <a href="mailto:legal@studyabroad.com">
                <Mail className="h-4 w-4" />
                legal@studyabroad.com
              </a>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </PageContainer>
  );
}
