'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Shield,
  Database,
  Share2,
  Lock,
  Eye,
  Bell,
  Globe,
  Mail,
  CheckCircle,
  ShieldCheck,
} from 'lucide-react';

import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const sections = [
  {
    id: 'collection',
    icon: Database,
    titleKey: 'collection.title',
    contentKey: 'collection.content',
    color: 'blue',
    items: [
      'collection.items.personal',
      'collection.items.academic',
      'collection.items.usage',
      'collection.items.device',
    ],
  },
  {
    id: 'usage',
    icon: Eye,
    titleKey: 'usage.title',
    contentKey: 'usage.content',
    color: 'violet',
    items: [
      'usage.items.service',
      'usage.items.personalization',
      'usage.items.communication',
      'usage.items.analytics',
    ],
  },
  {
    id: 'sharing',
    icon: Share2,
    titleKey: 'sharing.title',
    contentKey: 'sharing.content',
    color: 'amber',
    items: ['sharing.items.consent', 'sharing.items.legal', 'sharing.items.partners'],
  },
  {
    id: 'security',
    icon: Lock,
    titleKey: 'security.title',
    contentKey: 'security.content',
    color: 'emerald',
  },
  {
    id: 'rights',
    icon: Shield,
    titleKey: 'rights.title',
    contentKey: 'rights.content',
    color: 'rose',
    items: [
      'rights.items.access',
      'rights.items.correction',
      'rights.items.deletion',
      'rights.items.portability',
    ],
  },
  {
    id: 'cookies',
    icon: Globe,
    titleKey: 'cookies.title',
    contentKey: 'cookies.content',
    color: 'indigo',
  },
  {
    id: 'changes',
    icon: Bell,
    titleKey: 'changes.title',
    contentKey: 'changes.content',
    color: 'slate',
  },
];

const colorMap: Record<string, { bg: string; text: string; gradient: string; checkBg: string }> = {
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    gradient: 'bg-primary',
    checkBg: 'bg-blue-500',
  },
  violet: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    gradient: 'bg-primary',
    checkBg: 'bg-primary',
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    gradient: 'bg-warning',
    checkBg: 'bg-amber-500',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    gradient: 'bg-success',
    checkBg: 'bg-emerald-500',
  },
  rose: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-500',
    gradient: 'bg-destructive',
    checkBg: 'bg-rose-500',
  },
  indigo: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-500',
    gradient: 'from-indigo-500 to-blue-500',
    checkBg: 'bg-indigo-500',
  },
  slate: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    gradient: 'from-slate-500 to-gray-500',
    checkBg: 'bg-slate-500',
  },
};

export default function PrivacyPage() {
  const t = useTranslations('privacy');

  return (
    <PageContainer maxWidth="4xl">
      <PageHeader
        title={t('title')}
        description={t('lastUpdated', { date: '2026-01-01' })}
        icon={ShieldCheck}
        color="emerald"
      />

      {/* Commitment Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="mb-8 overflow-hidden border-emerald-500/20">
          <div className="h-1.5 bg-success" />
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success ">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <Badge variant="success" className="mb-2">
                  {t('securityBadge')}
                </Badge>
                <h3 className="font-semibold mb-2 text-lg">{t('commitment.title')}</h3>
                <p className="text-muted-foreground leading-relaxed">{t('commitment.content')}</p>
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
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed mb-4 pl-12">
                    {t(section.contentKey)}
                  </p>
                  {section.items && (
                    <ul className="space-y-2 pl-12">
                      {section.items.map((itemKey) => (
                        <li key={itemKey} className="flex items-center gap-3 text-sm">
                          <CheckCircle className={cn('h-4 w-4 shrink-0', colors.text)} />
                          <span className="text-muted-foreground">{t(itemKey)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
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
        transition={{ delay: 0.7 }}
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
              <a href="mailto:privacy@studyabroad.com">
                <Mail className="h-4 w-4" />
                privacy@studyabroad.com
              </a>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </PageContainer>
  );
}
