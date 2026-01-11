'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Loader2,
  Calendar,
  LayoutGrid,
  List,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Trash2,
  Edit,
  GraduationCap,
  FileText,
  Send,
  Target,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { format, differenceInDays, isPast } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Task {
  id: string;
  timelineId: string;
  title: string;
  type: string;
  description?: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  essayPrompt?: string;
  wordLimit?: number;
  sortOrder: number;
}

interface Timeline {
  id: string;
  schoolId: string;
  schoolName: string;
  round: string;
  deadline?: string;
  status: string;
  progress: number;
  priority: number;
  notes?: string;
  tasksTotal: number;
  tasksCompleted: number;
  createdAt: string;
  tasks?: Task[];
}

interface Overview {
  totalSchools: number;
  submitted: number;
  inProgress: number;
  notStarted: number;
  upcomingDeadlines: Timeline[];
  overdueTasks: Task[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  NOT_STARTED: { label: '未开始', color: 'text-gray-500', icon: Clock },
  IN_PROGRESS: { label: '进行中', color: 'text-blue-500', icon: Target },
  SUBMITTED: { label: '已提交', color: 'text-green-500', icon: Send },
  ACCEPTED: { label: '已录取', color: 'text-emerald-600', icon: Trophy },
  REJECTED: { label: '已拒绝', color: 'text-red-500', icon: AlertCircle },
  WAITLISTED: { label: '候补名单', color: 'text-yellow-500', icon: Clock },
  WITHDRAWN: { label: '已撤回', color: 'text-gray-400', icon: Trash2 },
};

const ROUND_LABELS: Record<string, string> = {
  ED: 'ED',
  ED2: 'ED2',
  EA: 'EA',
  REA: 'REA',
  RD: 'RD',
  Rolling: 'Rolling',
};

export default function TimelinePage() {
  const t = useTranslations('timeline');
  const queryClient = useQueryClient();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [selectedTimeline, setSelectedTimeline] = useState<Timeline | null>(null);

  // Queries
  const { data: overview, isLoading: overviewLoading } = useQuery<Overview>({
    queryKey: ['timeline-overview'],
    queryFn: () => apiClient.get('/timeline/overview'),
  });

  const { data: timelines, isLoading: timelinesLoading } = useQuery<Timeline[]>({
    queryKey: ['timelines'],
    queryFn: () => apiClient.get('/timeline'),
  });

  // Mutations
  const toggleTaskMutation = useMutation({
    mutationFn: (taskId: string) => apiClient.post(`/timeline/tasks/${taskId}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timelines'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
    },
  });

  const deleteTimelineMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/timeline/${id}`),
    onSuccess: () => {
      toast.success(t('deleted'));
      queryClient.invalidateQueries({ queryKey: ['timelines'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
    },
  });

  const getDeadlineStatus = (deadline?: string) => {
    if (!deadline) return null;
    const days = differenceInDays(new Date(deadline), new Date());
    if (days < 0) return { label: '已过期', color: 'text-red-500 bg-red-50' };
    if (days <= 7) return { label: `${days}天后`, color: 'text-orange-500 bg-orange-50' };
    if (days <= 30) return { label: `${days}天后`, color: 'text-yellow-500 bg-yellow-50' };
    return { label: `${days}天后`, color: 'text-green-500 bg-green-50' };
  };

  const renderOverviewCards = () => (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('totalSchools')}</p>
              <p className="text-3xl font-bold">{overview?.totalSchools || 0}</p>
            </div>
            <GraduationCap className="h-8 w-8 text-primary/20" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('submitted')}</p>
              <p className="text-3xl font-bold text-green-600">{overview?.submitted || 0}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-500/20" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('inProgress')}</p>
              <p className="text-3xl font-bold text-blue-600">{overview?.inProgress || 0}</p>
            </div>
            <Target className="h-8 w-8 text-blue-500/20" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('notStarted')}</p>
              <p className="text-3xl font-bold text-gray-600">{overview?.notStarted || 0}</p>
            </div>
            <Clock className="h-8 w-8 text-gray-400/20" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTimelineCard = (timeline: Timeline) => {
    const statusConfig = STATUS_CONFIG[timeline.status];
    const StatusIcon = statusConfig?.icon || Clock;
    const deadlineStatus = getDeadlineStatus(timeline.deadline);

    return (
      <motion.div
        key={timeline.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setSelectedTimeline(timeline)}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{timeline.schoolName}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{ROUND_LABELS[timeline.round]}</Badge>
                  <Badge variant="secondary" className={statusConfig?.color}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig?.label}
                  </Badge>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Edit className="h-4 w-4 mr-2" />
                    {t('edit')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTimelineMutation.mutate(timeline.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Progress */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('progress')}</span>
                <span className="font-medium">{timeline.progress}%</span>
              </div>
              <Progress value={timeline.progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {timeline.tasksCompleted}/{timeline.tasksTotal} {t('tasks')}
              </p>
            </div>

            {/* Deadline */}
            {timeline.deadline && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(timeline.deadline), 'MMM d, yyyy')}
                </div>
                {deadlineStatus && (
                  <Badge variant="outline" className={deadlineStatus.color}>
                    {deadlineStatus.label}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const renderKanbanView = () => {
    const columns = [
      { status: 'NOT_STARTED', title: t('notStarted') },
      { status: 'IN_PROGRESS', title: t('inProgress') },
      { status: 'SUBMITTED', title: t('submitted') },
    ];

    return (
      <div className="grid gap-4 md:grid-cols-3">
        {columns.map((col) => (
          <div key={col.status} className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-semibold">{col.title}</h3>
              <Badge variant="outline">
                {timelines?.filter((t) => t.status === col.status).length || 0}
              </Badge>
            </div>
            <div className="space-y-3 min-h-[200px] p-2 rounded-lg bg-muted/30">
              <AnimatePresence>
                {timelines
                  ?.filter((t) => t.status === col.status)
                  .map((timeline) => renderTimelineCard(timeline))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderListView = () => (
    <div className="space-y-3">
      <AnimatePresence>
        {timelines?.map((timeline) => renderTimelineCard(timeline))}
      </AnimatePresence>
    </div>
  );

  const renderTaskList = (timeline: Timeline) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{timeline.schoolName}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setSelectedTimeline(null)}>
            {t('close')}
          </Button>
        </div>
        <CardDescription>
          {ROUND_LABELS[timeline.round]} · {STATUS_CONFIG[timeline.status]?.label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {/* 这里需要单独获取任务列表 */}
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('loadingTasks')}
            </p>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  if (overviewLoading || timelinesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as 'kanban' | 'list')}>
            <TabsList>
              <TabsTrigger value="kanban">
                <LayoutGrid className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="list">
                <List className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {t('addSchool')}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {renderOverviewCards()}

      {/* Upcoming Deadlines Alert */}
      {overview?.upcomingDeadlines && overview.upcomingDeadlines.length > 0 && (
        <Card className="mt-6 border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-5 w-5" />
              {t('upcomingDeadlines')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {overview.upcomingDeadlines.map((dl) => (
                <Badge key={dl.id} variant="outline" className="bg-white">
                  {dl.schoolName} - {format(new Date(dl.deadline!), 'M/d')}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className={cn('lg:col-span-2', selectedTimeline && 'lg:col-span-2')}>
          {view === 'kanban' ? renderKanbanView() : renderListView()}
        </div>
        {selectedTimeline && (
          <div className="lg:col-span-1">{renderTaskList(selectedTimeline)}</div>
        )}
      </div>

      {/* Empty State */}
      {(!timelines || timelines.length === 0) && (
        <Card className="mt-8">
          <CardContent className="pt-6 text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">{t('noTimelines')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('noTimelinesDesc')}</p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('addFirstSchool')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}



