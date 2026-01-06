'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

const SCHOOL_TYPES = [
  { value: 'HIGH_SCHOOL', label: '高中' },
  { value: 'COLLEGE', label: '大学本科' },
  { value: 'GRADUATE', label: '研究生' },
  { value: 'OTHER', label: '其他' },
];

interface Education {
  id: string;
  schoolName: string;
  schoolType?: string;
  degree?: string;
  major?: string;
  startDate?: string;
  endDate?: string;
  gpa?: number;
  gpaScale?: number;
  description?: string;
}

interface EducationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  education?: Education | null;
  onSuccess?: () => void;
}

export function EducationForm({ open, onOpenChange, education, onSuccess }: EducationFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!education;

  const [formData, setFormData] = useState({
    schoolName: '',
    schoolType: '',
    degree: '',
    major: '',
    startDate: '',
    endDate: '',
    gpa: '',
    gpaScale: '4.0',
    description: '',
  });

  useEffect(() => {
    if (education) {
      setFormData({
        schoolName: education.schoolName || '',
        schoolType: education.schoolType || '',
        degree: education.degree || '',
        major: education.major || '',
        startDate: education.startDate?.slice(0, 10) || '',
        endDate: education.endDate?.slice(0, 10) || '',
        gpa: education.gpa?.toString() || '',
        gpaScale: education.gpaScale?.toString() || '4.0',
        description: education.description || '',
      });
    } else {
      setFormData({
        schoolName: '',
        schoolType: '',
        degree: '',
        major: '',
        startDate: '',
        endDate: '',
        gpa: '',
        gpaScale: '4.0',
        description: '',
      });
    }
  }, [education, open]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/profiles/me/education', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      onOpenChange(false);
      toast.success('教育经历已添加');
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiClient.put(`/profiles/me/education/${education?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      onOpenChange(false);
      toast.success('教育经历已更新');
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = () => {
    const data = {
      schoolName: formData.schoolName,
      schoolType: formData.schoolType || undefined,
      degree: formData.degree || undefined,
      major: formData.major || undefined,
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined,
      gpa: formData.gpa ? parseFloat(formData.gpa) : undefined,
      gpaScale: formData.gpaScale ? parseFloat(formData.gpaScale) : undefined,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑教育经历' : '添加教育经历'}</DialogTitle>
          <DialogDescription>
            {isEditing ? '修改您的教育经历信息' : '添加一段教育经历'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>学校名称 *</Label>
            <Input
              placeholder="例如：北京大学"
              value={formData.schoolName}
              onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>学校类型</Label>
              <Select
                value={formData.schoolType}
                onValueChange={(value) => setFormData({ ...formData, schoolType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  {SCHOOL_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>学位</Label>
              <Input
                placeholder="例如：学士"
                value={formData.degree}
                onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>专业</Label>
            <Input
              placeholder="例如：计算机科学"
              value={formData.major}
              onChange={(e) => setFormData({ ...formData, major: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>开始日期</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>结束日期</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>GPA</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="3.85"
                value={formData.gpa}
                onChange={(e) => setFormData({ ...formData, gpa: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>GPA 满分</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="4.0"
                value={formData.gpaScale}
                onChange={(e) => setFormData({ ...formData, gpaScale: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>描述</Label>
            <Textarea
              placeholder="可以添加课程、荣誉等信息"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!formData.schoolName || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}




