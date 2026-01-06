'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { Save, Loader2, Plus, X, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SchoolSelector } from './school-selector';

const CATEGORIES = [
  { value: 'school_ranking', label: '选校清单' },
  { value: 'major_ranking', label: '专业推荐' },
  { value: 'tips', label: '申请技巧' },
  { value: 'other', label: '其他' },
];

interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
}

interface CreateListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateListDialog({ open, onOpenChange }: CreateListDialogProps) {
  const queryClient = useQueryClient();
  const [schoolSelectorOpen, setSchoolSelectorOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'school_ranking',
    isPublic: true,
    schools: [] as School[],
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      category: string;
      isPublic: boolean;
      items: unknown[];
    }) => apiClient.post('/hall/lists', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicLists'] });
      queryClient.invalidateQueries({ queryKey: ['myLists'] });
      toast.success('清单创建成功');
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'school_ranking',
      isPublic: true,
      schools: [],
    });
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error('请输入清单标题');
      return;
    }

    if (formData.category === 'school_ranking' && formData.schools.length === 0) {
      toast.error('请至少选择一所学校');
      return;
    }

    createMutation.mutate({
      title: formData.title,
      description: formData.description || undefined,
      category: formData.category,
      isPublic: formData.isPublic,
      items: formData.schools.map((s, index) => ({
        rank: index + 1,
        schoolId: s.id,
        schoolName: s.nameZh || s.name,
        usNewsRank: s.usNewsRank,
      })),
    });
  };

  const removeSchool = (schoolId: string) => {
    setFormData((p) => ({
      ...p,
      schools: p.schools.filter((s) => s.id !== schoolId),
    }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>创建选校清单</DialogTitle>
            <DialogDescription>分享你的选校策略，帮助其他申请者</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>清单标题 *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder="例如：CS 专业 Top 20 选校清单"
                maxLength={100}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>分类</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>公开可见</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={formData.isPublic}
                    onCheckedChange={(checked) =>
                      setFormData((p) => ({ ...p, isPublic: checked }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {formData.isPublic ? '公开' : '仅自己可见'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>清单描述</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="介绍你的选校思路..."
                rows={3}
                maxLength={500}
              />
            </div>

            {formData.category === 'school_ranking' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>学校列表</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSchoolSelectorOpen(true)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    添加学校
                  </Button>
                </div>

                {formData.schools.length > 0 ? (
                  <div className="space-y-2 rounded-lg border p-3">
                    {formData.schools.map((school, index) => (
                      <div
                        key={school.id}
                        className="flex items-center gap-2 rounded bg-muted/50 px-3 py-2"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {index + 1}
                        </span>
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-sm">{school.nameZh || school.name}</span>
                        {school.usNewsRank && (
                          <Badge variant="outline" className="text-xs">
                            #{school.usNewsRank}
                          </Badge>
                        )}
                        <button
                          onClick={() => removeSchool(school.id)}
                          className="rounded-full p-1 hover:bg-muted"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-dashed p-6 text-center text-muted-foreground">
                    <GraduationCap className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p className="text-sm">点击"添加学校"选择院校</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              创建清单
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SchoolSelector
        open={schoolSelectorOpen}
        onOpenChange={setSchoolSelectorOpen}
        selectedSchools={formData.schools}
        onSelect={(schools) => setFormData((p) => ({ ...p, schools }))}
        maxSelection={20}
        title="选择学校"
      />
    </>
  );
}

