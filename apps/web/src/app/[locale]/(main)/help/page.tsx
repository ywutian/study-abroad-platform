'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Search,
  HelpCircle,
  BookOpen,
  Video,
  FileText,
  Mail,
  MessageCircle,
  ExternalLink,
  Lightbulb,
  Shield,
  Rocket,
  Settings,
  Sparkles,
} from 'lucide-react';

import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface FAQItem {
  id: string;
  questionKey: string;
  answerKey: string;
  category: string;
}

const faqData: FAQItem[] = [
  { id: '1', questionKey: 'howToStart', answerKey: 'howToStart', category: 'gettingStarted' },
  { id: '2', questionKey: 'whatCanAIDo', answerKey: 'whatCanAIDo', category: 'aiFeatures' },
  {
    id: '3',
    questionKey: 'predictionAccuracy',
    answerKey: 'predictionAccuracy',
    category: 'aiFeatures',
  },
  { id: '4', questionKey: 'dataPrivacy', answerKey: 'dataPrivacy', category: 'privacySecurity' },
  {
    id: '5',
    questionKey: 'deleteAccount',
    answerKey: 'deleteAccount',
    category: 'privacySecurity',
  },
  { id: '6', questionKey: 'shareCase', answerKey: 'shareCase', category: 'featureUsage' },
  { id: '7', questionKey: 'exportData', answerKey: 'exportData', category: 'featureUsage' },
  { id: '8', questionKey: 'verifiedUser', answerKey: 'verifiedUser', category: 'gettingStarted' },
];

const categories = ['all', 'gettingStarted', 'aiFeatures', 'featureUsage', 'privacySecurity'];

const categoryConfig: Record<string, { icon: typeof HelpCircle; color: string }> = {
  all: { icon: HelpCircle, color: 'blue' },
  gettingStarted: { icon: Rocket, color: 'emerald' },
  aiFeatures: { icon: Sparkles, color: 'violet' },
  featureUsage: { icon: Settings, color: 'amber' },
  privacySecurity: { icon: Shield, color: 'rose' },
};

const resourceConfig = [
  { key: 'docs', icon: BookOpen, color: 'blue', gradient: 'bg-primary' },
  { key: 'video', icon: Video, color: 'rose', gradient: 'bg-destructive' },
  { key: 'blog', icon: FileText, color: 'violet', gradient: 'bg-primary' },
];

export default function HelpPage() {
  const t = useTranslations('helpCenter');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredFAQs = useMemo(() => {
    return faqData.filter((faq) => {
      const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
      const matchesSearch =
        !searchQuery ||
        t(`faqItems.${faq.questionKey}.question`)
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        t(`faqItems.${faq.answerKey}.answer`).toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, activeCategory, t]);

  return (
    <PageContainer maxWidth="5xl">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={HelpCircle}
        color="blue"
      />

      {/* Search Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Card className="overflow-hidden">
          <div className="h-1 bg-primary" />
          <CardContent className="pt-6 pb-6">
            <div className="relative max-w-2xl mx-auto">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 mx-auto mb-4">
                <Search className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="text-center text-lg font-semibold mb-4">{t('searchTitle')}</h3>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 text-base"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Resources */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {resourceConfig.map((resource, index) => {
          const Icon = resource.icon;
          return (
            <motion.div
              key={resource.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300">
                <div className={cn('h-1 bg-gradient-to-r', resource.gradient)} />
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300',
                      `bg-${resource.color}-500/10 group-hover:bg-${resource.color}-500/20`
                    )}
                  >
                    <Icon className={cn('h-6 w-6', `text-${resource.color}-500`)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{t(`resources.${resource.key}.title`)}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {t(`resources.${resource.key}.description`)}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* FAQ Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="overflow-hidden">
          <div className="h-1 bg-warning" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <Lightbulb className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <CardTitle>{t('faqTitle')}</CardTitle>
                <CardDescription>{t('faqDescription')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Category Tabs */}
            <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-6">
              <TabsList className="flex-wrap h-auto gap-2 bg-transparent p-0">
                {categories.map((cat) => {
                  const config = categoryConfig[cat];
                  const CatIcon = config.icon;
                  return (
                    <TabsTrigger
                      key={cat}
                      value={cat}
                      className={cn(
                        'gap-2 rounded-full px-4 data-[state=active]:shadow-sm transition-all',
                        cat === 'all' &&
                          'data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600',
                        cat === 'gettingStarted' &&
                          'data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600',
                        cat === 'aiFeatures' &&
                          'data-[state=active]:bg-primary/10 data-[state=active]:text-primary',
                        cat === 'featureUsage' &&
                          'data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600',
                        cat === 'privacySecurity' &&
                          'data-[state=active]:bg-rose-500/10 data-[state=active]:text-rose-600'
                      )}
                    >
                      <CatIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        {cat === 'all' ? t('all') : t(`categories.${cat}`)}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>

            {/* FAQ Accordion */}
            {filteredFAQs.length > 0 ? (
              <Accordion type="single" collapsible className="w-full space-y-2">
                {filteredFAQs.map((faq, index) => {
                  const _config = categoryConfig[faq.category];
                  return (
                    <motion.div
                      key={faq.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <AccordionItem
                        value={faq.id}
                        className="border rounded-xl px-4 data-[state=open]:bg-muted/30"
                      >
                        <AccordionTrigger className="text-left hover:no-underline py-4">
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                'shrink-0',
                                faq.category === 'gettingStarted' &&
                                  'border-emerald-500/30 text-emerald-600 bg-emerald-500/5',
                                faq.category === 'aiFeatures' &&
                                  'border-violet-500/30 text-primary bg-primary/5',
                                faq.category === 'featureUsage' &&
                                  'border-amber-500/30 text-amber-600 bg-amber-500/5',
                                faq.category === 'privacySecurity' &&
                                  'border-rose-500/30 text-rose-600 bg-rose-500/5'
                              )}
                            >
                              {t(`categories.${faq.category}`)}
                            </Badge>
                            <span className="font-medium">
                              {t(`faqItems.${faq.questionKey}.question`)}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pb-4 pl-[90px]">
                          {t(`faqItems.${faq.answerKey}.answer`)}
                        </AccordionContent>
                      </AccordionItem>
                    </motion.div>
                  );
                })}
              </Accordion>
            ) : (
              <div className="text-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                  <HelpCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">{t('noResults')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Contact Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-8"
      >
        <Card className="overflow-hidden">
          <div className="h-1 bg-success" />
          <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                <MessageCircle className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{t('otherQuestions')}</h3>
                <p className="text-muted-foreground">{t('contactSupport')}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2" asChild>
                <a href="mailto:support@studyabroad.com">
                  <Mail className="h-4 w-4" />
                  {t('sendEmail')}
                </a>
              </Button>
              <Button className="gap-2 bg-success hover:opacity-90 text-white ">
                <MessageCircle className="h-4 w-4" />
                {t('onlineService')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </PageContainer>
  );
}
