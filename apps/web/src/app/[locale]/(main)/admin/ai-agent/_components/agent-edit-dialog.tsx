'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api';
import { adminAiAgentRoutes } from '@study-abroad/shared';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ModelSelect } from './model-select';

interface AgentEditDialogProps {
  editingAgent: string | null;
  agentName: string;
  agentForm: { model: string; temperature: number; maxTokens: number };
  setAgentForm: (form: { model: string; temperature: number; maxTokens: number }) => void;
  onClose: () => void;
}

export function AgentEditDialog({
  editingAgent,
  agentName,
  agentForm,
  setAgentForm,
  onClose,
}: AgentEditDialogProps) {
  const t = useTranslations('admin.aiAgent');
  const queryClient = useQueryClient();

  const updateAgentMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: ({ type, ...data }: { type: string; [key: string]: any }) =>
      apiClient.put(adminAiAgentRoutes.agentById(type), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiAgentAgents'] });
      toast.success(t('agentUpdated'));
      onClose();
    },
  });

  return (
    <Dialog open={!!editingAgent} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('editAgent')}</DialogTitle>
          <DialogDescription>{agentName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('agentModel')}</Label>
            <ModelSelect
              value={agentForm.model}
              onValueChange={(v) => setAgentForm({ ...agentForm, model: v })}
              placeholder={t('agentModelPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('agentModelDesc')}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('agentTemp')}</Label>
              <span className="text-sm font-mono">{agentForm.temperature.toFixed(1)}</span>
            </div>
            <Slider
              value={[agentForm.temperature]}
              onValueChange={([v]) => setAgentForm({ ...agentForm, temperature: v })}
              min={0}
              max={2}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">{t('agentTempDesc')}</p>
          </div>
          <div className="space-y-2">
            <Label>{t('agentMaxTokens')}</Label>
            <Input
              type="number"
              min={100}
              max={8000}
              value={agentForm.maxTokens}
              onChange={(e) => setAgentForm({ ...agentForm, maxTokens: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">{t('agentMaxTokensDesc')}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            onClick={() => {
              if (!editingAgent) return;
              updateAgentMutation.mutate({
                type: editingAgent,
                model: agentForm.model,
                temperature: agentForm.temperature,
                maxTokens: agentForm.maxTokens,
              });
            }}
            disabled={updateAgentMutation.isPending}
          >
            {updateAgentMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
