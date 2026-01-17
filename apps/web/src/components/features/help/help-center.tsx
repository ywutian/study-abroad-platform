'use client';

import { useState, useMemo } from 'react';
import { useHydrated } from '@/hooks/use-hydration';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Search,
  BookOpen,
  MessageCircle,
  Video,
  FileText,
  ExternalLink,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// FAQ 数据
interface FAQItem {
  id: string;
  questionKey: string;
  answerKey: string;
  categoryKey: string;
}

// FAQ data keys for translation
const faqDataKeys: FAQItem[] = [
  { id: '1', questionKey: 'howToStart', answerKey: 'howToStart', categoryKey: 'gettingStarted' },
  { id: '2', questionKey: 'whatCanAIDo', answerKey: 'whatCanAIDo', categoryKey: 'aiFeatures' },
  {
    id: '3',
    questionKey: 'predictionAccuracy',
    answerKey: 'predictionAccuracy',
    categoryKey: 'aiFeatures',
  },
  { id: '4', questionKey: 'viewCases', answerKey: 'viewCases', categoryKey: 'usage' },
  { id: '5', questionKey: 'dataSecure', answerKey: 'dataSecure', categoryKey: 'privacySecurity' },
  { id: '6', questionKey: 'exportData', answerKey: 'exportData', categoryKey: 'usage' },
];

// Help resources config
const helpResourcesConfig = [
  { id: 'docs', icon: BookOpen, url: '/docs', external: false },
  { id: 'video', icon: Video, url: 'https://youtube.com', external: true },
  { id: 'blog', icon: FileText, url: '/blog', external: false },
];

// Category keys
const categoryKeys = ['gettingStarted', 'aiFeatures', 'featureUsage', 'privacySecurity'];

export function HelpCenter() {
  const t = useTranslations('helpCenter');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const isHydrated = useHydrated();

  // Get translated FAQ data
  const faqData = useMemo(
    () =>
      faqDataKeys.map((faq) => ({
        id: faq.id,
        question: t(`faqItems.${faq.questionKey}.question`),
        answer: t(`faqItems.${faq.answerKey}.answer`),
        category: t(`categories.${faq.categoryKey}`),
        categoryKey: faq.categoryKey,
      })),
    [t]
  );

  // Get translated categories
  const categories = useMemo(
    () =>
      categoryKeys.map((key) => ({
        key,
        label: t(`categories.${key}`),
      })),
    [t]
  );

  // Get translated help resources
  const helpResources = useMemo(
    () =>
      helpResourcesConfig.map((res) => ({
        ...res,
        title: t(`resources.${res.id}.title`),
        description: t(`resources.${res.id}.description`),
      })),
    [t]
  );

  // 过滤 FAQ
  const filteredFAQs = faqData.filter((faq) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = !selectedCategory || faq.categoryKey === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  if (!isHydrated) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        data-tour="help"
        suppressHydrationWarning
      >
        <HelpCircle className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-tour="help">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-[480px] p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="text-left">{t('title')}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-6 space-y-6">
            {/* 搜索 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="pl-10"
              />
            </div>

            {/* 快速资源 */}
            <div className="grid grid-cols-3 gap-3">
              {helpResources.map((resource) => {
                const Icon = resource.icon;
                return (
                  <a
                    key={resource.id}
                    href={resource.url}
                    target={resource.external ? '_blank' : undefined}
                    rel={resource.external ? 'noopener noreferrer' : undefined}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-center"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{resource.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {resource.description}
                      </p>
                    </div>
                    {resource.external && (
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    )}
                  </a>
                );
              })}
            </div>

            {/* 分类标签 */}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={selectedCategory === null ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedCategory(null)}
              >
                {t('all')}
              </Badge>
              {categories.map((category) => (
                <Badge
                  key={category.key}
                  variant={selectedCategory === category.key ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory(category.key)}
                >
                  {category.label}
                </Badge>
              ))}
            </div>

            {/* FAQ 列表 */}
            <div>
              <h3 className="text-sm font-semibold mb-3">{t('faqTitle')}</h3>
              {filteredFAQs.length === 0 ? (
                <div className="text-center py-8">
                  <HelpCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('noResults')}</p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full space-y-2">
                  {filteredFAQs.map((faq) => (
                    <AccordionItem key={faq.id} value={faq.id} className="border rounded-lg px-4">
                      <AccordionTrigger className="text-sm text-left hover:no-underline py-3">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground pb-4">
                        <p>{faq.answer}</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>

            {/* 联系支持 */}
            <div className="rounded-xl border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold mb-2">{t('otherQuestions')}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t('contactSupport')}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="flex-1" asChild>
                  <a href="mailto:support@studyabroad.com">
                    <Mail className="w-4 h-4 mr-2" />
                    {t('sendEmail')}
                  </a>
                </Button>
                <Button className="flex-1">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {t('onlineService')}
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
