'use client';

import { useState } from 'react';
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
import { Loader2, Send, GraduationCap } from 'lucide-react';
import { SchoolSelector } from './school-selector';

const RESULTS = [
  { value: 'ADMITTED', label: '录取' },
  { value: 'REJECTED', label: '拒绝' },
  { value: 'WAITLISTED', label: '候补' },
  { value: 'DEFERRED', label: '延期' },
];

const ROUNDS = [
  { value: 'ED', label: 'ED (Early Decision)' },
  { value: 'ED2', label: 'ED2' },
  { value: 'EA', label: 'EA (Early Action)' },
  { value: 'REA', label: 'REA (Restrictive EA)' },
  { value: 'RD', label: 'RD (Regular Decision)' },
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

interface SubmitCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SubmitCaseDialog({ open, onOpenChange, onSuccess }: SubmitCaseDialogProps) {
  const queryClient = useQueryClient();
  const [schoolSelectorOpen, setSchoolSelectorOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);

  const [formData, setFormData] = useState({
    year: new Date().getFullYear().toString(),
    round: '',
    result: '',
    major: '',
    gpaRange: '',
    satRange: '',
    toeflRange: '',
    tags: '',
    reflection: '',
  });

  const submitMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/cases', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      onOpenChange(false);
      resetForm();
      toast.success('案例提交成功，感谢分享！');
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      year: new Date().getFullYear().toString(),
      round: '',
      result: '',
      major: '',
      gpaRange: '',
      satRange: '',
      toeflRange: '',
      tags: '',
      reflection: '',
    });
    setSelectedSchool(null);
  };

  const handleSubmit = () => {
    if (!selectedSchool || !formData.result) {
      toast.error('请填写必填项');
      return;
    }

    const data = {
      schoolId: selectedSchool.id,
      year: parseInt(formData.year),
      round: formData.round || undefined,
      result: formData.result,
      major: formData.major || undefined,
      gpaRange: formData.gpaRange || undefined,
      satRange: formData.satRange || undefined,
      toeflRange: formData.toeflRange || undefined,
      tags: formData.tags ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      reflection: formData.reflection || undefined,
    };

    submitMutation.mutate(data);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              提交录取案例
            </DialogTitle>
            <DialogDescription>
              分享您的申请结果，帮助后来者参考
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* School Selection */}
            <div className="space-y-2">
              <Label>学校 *</Label>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setSchoolSelectorOpen(true)}
              >
                {selectedSchool ? (
                  <span>{selectedSchool.nameZh || selectedSchool.name}</span>
                ) : (
                  <span className="text-muted-foreground">选择学校</span>
                )}
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>申请年份 *</Label>
                <Select
                  value={formData.year}
                  onValueChange={(value) => setFormData({ ...formData, year: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2026, 2025, 2024, 2023, 2022].map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>申请轮次</Label>
                <Select
                  value={formData.round}
                  onValueChange={(value) => setFormData({ ...formData, round: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择轮次" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUNDS.map((round) => (
                      <SelectItem key={round.value} value={round.value}>
                        {round.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>申请结果 *</Label>
                <Select
                  value={formData.result}
                  onValueChange={(value) => setFormData({ ...formData, result: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择结果" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESULTS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>专业</Label>
                <Input
                  placeholder="例如：Computer Science"
                  value={formData.major}
                  onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>GPA 范围</Label>
                <Input
                  placeholder="例如：3.8-4.0"
                  value={formData.gpaRange}
                  onChange={(e) => setFormData({ ...formData, gpaRange: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>SAT 范围</Label>
                <Input
                  placeholder="例如：1500-1550"
                  value={formData.satRange}
                  onChange={(e) => setFormData({ ...formData, satRange: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>TOEFL 范围</Label>
                <Input
                  placeholder="例如：110-115"
                  value={formData.toeflRange}
                  onChange={(e) => setFormData({ ...formData, toeflRange: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>标签</Label>
              <Input
                placeholder="用逗号分隔，例如：科研强, 竞赛获奖"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>申请感悟</Label>
              <Textarea
                placeholder="分享您的申请经验和建议..."
                value={formData.reflection}
                onChange={(e) => setFormData({ ...formData, reflection: e.target.value })}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedSchool || !formData.result || submitMutation.isPending}
            >
              {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />
              提交案例
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SchoolSelector
        open={schoolSelectorOpen}
        onOpenChange={setSchoolSelectorOpen}
        selectedSchools={selectedSchool ? [selectedSchool] : []}
        onSelect={(schools) => setSelectedSchool(schools[0] || null)}
        maxSelection={1}
        title="选择申请学校"
      />
    </>
  );
}

