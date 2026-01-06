'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

const AWARD_LEVELS = [
  { value: 'SCHOOL', label: '校级' },
  { value: 'REGIONAL', label: '区域级' },
  { value: 'STATE', label: '省/州级' },
  { value: 'NATIONAL', label: '国家级' },
  { value: 'INTERNATIONAL', label: '国际级' },
];

interface Award {
  id: string;
  name: string;
  level: string;
  year?: number;
  description?: string;
}

interface AwardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAward?: Award | null;
}

export function AwardForm({ open, onOpenChange, editingAward }: AwardFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editingAward;

  const [formData, setFormData] = useState({
    name: editingAward?.name || '',
    level: editingAward?.level || '',
    year: editingAward?.year?.toString() || '',
    description: editingAward?.description || '',
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.post('/profiles/me/awards', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('奖项添加成功');
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.put(`/profiles/me/awards/${editingAward?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('奖项更新成功');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      level: '',
      year: '',
      description: '',
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.level) {
      toast.error('请填写奖项名称和级别');
      return;
    }

    const data = {
      name: formData.name,
      level: formData.level,
      year: formData.year ? parseInt(formData.year) : undefined,
      description: formData.description || undefined,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑奖项' : '添加奖项'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>奖项名称 *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder="例如：AMC 12 满分"
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>奖项级别 *</Label>
              <Select
                value={formData.level}
                onValueChange={(v) => setFormData((p) => ({ ...p, level: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择级别" />
                </SelectTrigger>
                <SelectContent>
                  {AWARD_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>获奖年份</Label>
              <Input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData((p) => ({ ...p, year: e.target.value }))}
                placeholder="2025"
                min={2000}
                max={2030}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>奖项描述</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="简要描述这个奖项的含金量或你的成就..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{formData.description.length}/500</p>
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




