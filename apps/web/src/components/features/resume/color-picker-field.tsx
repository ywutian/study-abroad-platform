'use client';

import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const PRESET_COLORS = [
  '#1e3a5f',
  '#333333',
  '#2d5016',
  '#0d9488',
  '#4f46e5',
  '#ef4444',
  '#f59e0b',
  '#7c3aed',
  '#e11d48',
  '#000000',
  '#475569',
  '#7f1d1d',
  '#555d3c',
  '#1d4ed8',
  '#fff9ef',
  '#fff9ef',
];

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

interface ColorPickerFieldProps {
  label: string;
  value?: string;
  defaultValue: string;
  onChange: (color: string) => void;
  onClear: () => void;
}

export function ColorPickerField({
  label,
  value,
  defaultValue,
  onChange,
  onClear,
}: ColorPickerFieldProps) {
  const displayColor = value || defaultValue;
  const [inputValue, setInputValue] = useState(value || '');
  const isCustomized = value !== undefined;

  const handleInputChange = useCallback(
    (raw: string) => {
      const hex = raw.startsWith('#') ? raw : `#${raw}`;
      setInputValue(hex);
      if (HEX_PATTERN.test(hex)) {
        onChange(hex);
      }
    },
    [onChange]
  );

  const handlePresetClick = useCallback(
    (color: string) => {
      setInputValue(color);
      onChange(color);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    setInputValue('');
    onClear();
  }, [onClear]);

  return (
    <div className="flex items-center gap-2">
      <Label className="w-24 shrink-0 text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="h-7 w-7 shrink-0 rounded border border-input shadow-sm transition-colors hover:border-ring"
            style={{ backgroundColor: displayColor }}
            title={displayColor}
          />
        </PopoverTrigger>
        <PopoverContent className="w-52 p-3" align="start">
          <div className="grid grid-cols-8 gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                className="h-5 w-5 rounded-sm border border-input transition-transform hover:scale-110"
                style={{ backgroundColor: color }}
                onClick={() => handlePresetClick(color)}
                title={color}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Input
        className="h-7 flex-1 font-mono text-xs"
        placeholder={defaultValue}
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        maxLength={7}
      />
      {isCustomized && (
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleClear}>
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
