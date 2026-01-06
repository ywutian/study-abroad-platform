'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Save, Loader2 } from 'lucide-react';

const ACTIVITY_CATEGORIES = [
  { value: 'ACADEMIC', label: '学术研究' },
  { value: 'ARTS', label: '艺术' },
  { value: 'ATHLETICS', label: '体育' },
  { value: 'COMMUNITY_SERVICE', label: '社区服务' },
  { value: 'LEADERSHIP', label: '领导力' },
  { value: 'WORK', label: '工作/实习' },
  { value: 'RESEARCH', label: '科研' },
  { value: 'OTHER', label: '其他' },
];

interface Activity {
  id: string;
  name: string;
  category: string;
  role: string;
  organization?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  hoursPerWeek?: number;
  weeksPerYear?: number;
  isOngoing?: boolean;
}

interface ActivityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingActivity?: Activity | null;
}

export function ActivityForm({ open, onOpenChange, editingActivity }: ActivityFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editingActivity;

  const [formData, setFormData] = useState({
    name: editingActivity?.name || '',
    category: editingActivity?.category || '',
    role: editingActivity?.role || '',
    organization: editingActivity?.organization || '',
    description: editingActivity?.description || '',
    startDate: editingActivity?.startDate?.slice(0, 10) || '',
    endDate: editingActivity?.endDate?.slice(0, 10) || '',
    hoursPerWeek: editingActivity?.hoursPerWeek?.toString() || '',
    weeksPerYear: editingActivity?.weeksPerYear?.toString() || '',
    isOngoing: editingActivity?.isOngoing || false,
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.post('/profiles/me/activities', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('活动添加成功');
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: unknown) =>
      apiClient.put(`/profiles/me/activities/${editingActivity?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('活动更新成功');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      role: '',
      organization: '',
      description: '',
      startDate: '',
      endDate: '',
      hoursPerWeek: '',
      weeksPerYear: '',
      isOngoing: false,
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.category || !formData.role) {
      toast.error('请填写活动名称、类别和角色');
      return;
    }

    const data = {
      name: formData.name,
      category: formData.category,
      role: formData.role,
      organization: formData.organization || undefined,
      description: formData.description || undefined,
      startDate: formData.startDate || undefined,
      endDate: formData.isOngoing ? undefined : formData.endDate || undefined,
      hoursPerWeek: formData.hoursPerWeek ? parseInt(formData.hoursPerWeek) : undefined,
      weeksPerYear: formData.weeksPerYear ? parseInt(formData.weeksPerYear) : undefined,
      isOngoing: formData.isOngoing,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑活动' : '添加活动'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>活动名称 *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder="例如：机器人社"
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>活动类别 *</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择类别" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>角色/职位 *</Label>
              <Input
                value={formData.role}
                onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
                placeholder="例如：社长"
                maxLength={100}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>组织名称</Label>
            <Input
              value={formData.organization}
              onChange={(e) => setFormData((p) => ({ ...p, organization: e.target.value }))}
              placeholder="例如：学校科技创新中心"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label>活动描述</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="简要描述你的职责和成就..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{formData.description.length}/500</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>开始日期</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>结束日期</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                disabled={formData.isOngoing}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isOngoing"
              checked={formData.isOngoing}
              onCheckedChange={(checked) =>
                setFormData((p) => ({ ...p, isOngoing: checked as boolean }))
              }
            />
            <Label htmlFor="isOngoing" className="cursor-pointer">
              活动进行中
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>每周小时数</Label>
              <Input
                type="number"
                value={formData.hoursPerWeek}
                onChange={(e) => setFormData((p) => ({ ...p, hoursPerWeek: e.target.value }))}
                placeholder="1 - 40"
                min={1}
                max={40}
              />
            </div>

            <div className="space-y-2">
              <Label>每年周数</Label>
              <Input
                type="number"
                value={formData.weeksPerYear}
                onChange={(e) => setFormData((p) => ({ ...p, weeksPerYear: e.target.value }))}
                placeholder="1 - 52"
                min={1}
                max={52}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}




