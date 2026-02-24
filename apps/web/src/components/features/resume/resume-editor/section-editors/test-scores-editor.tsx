'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { TestScoreItem } from '@study-abroad/shared';

interface TestScoresEditorProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
}

const TEST_TYPES = ['SAT', 'ACT', 'TOEFL', 'IELTS', 'GRE', 'GMAT', 'AP', 'IB', 'LSAT', 'MCAT'];

export function TestScoresEditor({ content, onChange }: TestScoresEditorProps) {
  const items = ((content as any).items ?? []) as TestScoreItem[];

  const updateItem = (index: number, field: string, value: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...content, items: updated });
  };

  const updateSubScore = (index: number, key: string, value: string) => {
    const updated = [...items];
    const subScores = { ...(updated[index].subScores ?? {}) };
    if (value === '') {
      delete subScores[key];
    } else {
      subScores[key] = Number(value);
    }
    updated[index] = { ...updated[index], subScores };
    onChange({ ...content, items: updated });
  };

  const addItem = () => {
    const newItem: TestScoreItem = {
      id: crypto.randomUUID(),
      type: '',
      score: 0,
    };
    onChange({ ...content, items: [...items, newItem] });
  };

  const removeItem = (index: number) => {
    onChange({ ...content, items: items.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.id} className="space-y-2">
          {index > 0 && <Separator />}
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              onClick={() => removeItem(index)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Test Type</Label>
              <Input
                value={item.type}
                onChange={(e) => updateItem(index, 'type', e.target.value)}
                placeholder="SAT, TOEFL, etc."
                list={`test-types-${index}`}
                className="h-7 text-xs"
              />
              <datalist id={`test-types-${index}`}>
                {TEST_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Score</Label>
              <Input
                value={item.score || ''}
                onChange={(e) =>
                  updateItem(index, 'score', e.target.value ? Number(e.target.value) : 0)
                }
                className="h-7 text-xs"
                type="number"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Test Date</Label>
              <Input
                value={item.testDate ?? ''}
                onChange={(e) => updateItem(index, 'testDate', e.target.value)}
                className="h-7 text-xs"
                type="month"
              />
            </div>
          </div>
          {/* Sub-scores section */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sub-Scores (optional)</Label>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(item.subScores ?? {}).map(([key, val]: [string, number]) => (
                <div key={key} className="flex items-center gap-1">
                  <Input value={key} className="h-6 w-20 text-xs" readOnly />
                  <Input
                    value={val}
                    onChange={(e) => updateSubScore(index, key, e.target.value)}
                    className="h-6 w-16 text-xs"
                    type="number"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-destructive"
                    onClick={() => updateSubScore(index, key, '')}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </div>
              ))}
              <SubScoreInput onAdd={(key, value) => updateSubScore(index, key, value)} />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={addItem}>
        <Plus className="mr-1 h-3 w-3" />
        Add Test Score
      </Button>
    </div>
  );
}

function SubScoreInput({ onAdd }: { onAdd: (key: string, value: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Input
        placeholder="Name"
        className="h-6 w-20 text-xs"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const input = e.currentTarget;
            const name = input.value.trim();
            if (name) {
              onAdd(name, '0');
              input.value = '';
            }
          }
        }}
      />
      <span className="text-xs text-muted-foreground">Enter to add</span>
    </div>
  );
}
