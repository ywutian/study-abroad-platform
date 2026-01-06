'use client';

import { useState } from 'react';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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
  question: string;
  answer: string;
  category: string;
  tags?: string[];
}

const faqData: FAQItem[] = [
  {
    id: '1',
    question: '如何开始使用平台？',
    answer: '注册账号后，您可以先完善个人资料，包括学术背景、语言成绩等信息。然后浏览院校库了解目标学校，或直接与 AI 助手对话获取个性化建议。',
    category: '入门指南',
    tags: ['新手', '注册'],
  },
  {
    id: '2',
    question: 'AI 助手可以帮我做什么？',
    answer: 'AI 助手可以根据您的背景提供选校建议、分析录取概率、回答留学相关问题、帮助规划申请时间线，以及提供文书写作建议。',
    category: 'AI 功能',
    tags: ['AI', '选校', '文书'],
  },
  {
    id: '3',
    question: '录取预测的准确性如何？',
    answer: '我们的预测模型基于大量历史申请数据训练，准确率约为 85%。但请注意，预测仅供参考，实际录取还会受到多种因素影响。',
    category: 'AI 功能',
    tags: ['预测', '录取'],
  },
  {
    id: '4',
    question: '如何查看申请案例？',
    answer: '在"案例库"页面，您可以按学校、专业、录取结果等条件筛选案例。每个案例都包含申请者的背景信息和经验分享。',
    category: '功能使用',
    tags: ['案例', '筛选'],
  },
  {
    id: '5',
    question: '我的个人信息安全吗？',
    answer: '我们严格遵守数据保护法规，采用加密传输和存储。您的个人信息仅用于提供服务，不会分享给第三方。您也可以随时删除账号和数据。',
    category: '隐私安全',
    tags: ['隐私', '安全', '数据'],
  },
  {
    id: '6',
    question: '如何导出我的申请数据？',
    answer: '在个人中心的"设置"页面，点击"导出数据"按钮，可以下载包含您所有申请信息的 JSON 或 CSV 文件。',
    category: '功能使用',
    tags: ['导出', '数据'],
  },
];

// 帮助资源
const helpResources = [
  {
    id: 'docs',
    title: '使用文档',
    description: '详细的功能说明和操作指南',
    icon: BookOpen,
    url: '/docs',
    external: false,
  },
  {
    id: 'video',
    title: '视频教程',
    description: '观看视频快速上手',
    icon: Video,
    url: 'https://youtube.com',
    external: true,
  },
  {
    id: 'blog',
    title: '留学攻略',
    description: '申请技巧和经验分享',
    icon: FileText,
    url: '/blog',
    external: false,
  },
];

// 获取分类列表
const categories = [...new Set(faqData.map(faq => faq.category))];

export function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 过滤 FAQ
  const filteredFAQs = faqData.filter(faq => {
    const matchesSearch = searchQuery.trim() === '' || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = !selectedCategory || faq.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="relative"
          data-tour="help"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-[480px] p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="text-left">帮助中心</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-6 space-y-6">
            {/* 搜索 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索帮助内容..."
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
                全部
              </Badge>
              {categories.map((category) => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>

            {/* FAQ 列表 */}
            <div>
              <h3 className="text-sm font-semibold mb-3">常见问题</h3>
              {filteredFAQs.length === 0 ? (
                <div className="text-center py-8">
                  <HelpCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    未找到相关问题
                  </p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full space-y-2">
                  {filteredFAQs.map((faq) => (
                    <AccordionItem 
                      key={faq.id} 
                      value={faq.id}
                      className="border rounded-lg px-4"
                    >
                      <AccordionTrigger className="text-sm text-left hover:no-underline py-3">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground pb-4">
                        <p>{faq.answer}</p>
                        {faq.tags && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {faq.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>

            {/* 联系支持 */}
            <div className="rounded-xl border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold mb-2">还有其他问题？</h3>
              <p className="text-sm text-muted-foreground mb-4">
                如果您没有找到答案，可以联系我们的客服团队。
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="flex-1" asChild>
                  <a href="mailto:support@studyabroad.com">
                    <Mail className="w-4 h-4 mr-2" />
                    发送邮件
                  </a>
                </Button>
                <Button className="flex-1">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  在线客服
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}



