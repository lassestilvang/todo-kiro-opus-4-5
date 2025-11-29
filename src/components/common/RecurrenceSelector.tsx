'use client';

import * as React from 'react';
import { Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { RecurrencePattern, RecurrenceType } from '@/types';
import { formatRecurrencePattern } from '@/lib/utils/recurrence';

/** Preset recurrence options */
interface RecurrencePreset {
  value: RecurrenceType | 'none';
  label: string;
  pattern?: RecurrencePattern;
}

const RECURRENCE_PRESETS: RecurrencePreset[] = [
  { value: 'none', label: 'No repeat' },
  { value: 'daily', label: 'Every day', pattern: { type: 'daily', interval: 1 } },
  { value: 'weekly', label: 'Every week', pattern: { type: 'weekly', interval: 1 } },
  { value: 'weekday', label: 'Every weekday', pattern: { type: 'weekday' } },
  { value: 'monthly', label: 'Every month', pattern: { type: 'monthly', interval: 1 } },
  { value: 'yearly', label: 'Every year', pattern: { type: 'yearly', interval: 1 } },
  { value: 'custom', label: 'Custom...' },
];

const WEEKDAYS = [
  { value: 0, label: 'Sun', fullLabel: 'Sunday' },
  { value: 1, label: 'Mon', fullLabel: 'Monday' },
  { value: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { value: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { value: 4, label: 'Thu', fullLabel: 'Thursday' },
  { value: 5, label: 'Fri', fullLabel: 'Friday' },
  { value: 6, label: 'Sat', fullLabel: 'Saturday' },
];

const ORDINALS = [
  { value: 1, label: '1st' },
  { value: 2, label: '2nd' },
  { value: 3, label: '3rd' },
  { value: 4, label: '4th' },
  { value: 5, label: '5th' },
];

export interface RecurrenceSelectorProps {
  /** Currently selected recurrence pattern */
  value?: RecurrencePattern;
  /** Callback when recurrence changes */
  onChange: (pattern: RecurrencePattern | undefined) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Whether to show the repeat icon */
  showIcon?: boolean;
}

type CustomType = 'interval' | 'weekdays' | 'ordinal' | 'monthDay';

/**
 * RecurrenceSelector Component
 * Allows selection of preset recurrence patterns or custom configuration.
 * Shows human-readable preview of the selected pattern.
 * 
 * Requirements: 10.1, 10.3, 10.4
 */
export function RecurrenceSelector({
  value,
  onChange,
  disabled = false,
  className,
  showIcon = true,
}: RecurrenceSelectorProps): React.ReactElement {
  const [showCustom, setShowCustom] = React.useState(false);
  const [customType, setCustomType] = React.useState<CustomType>('interval');
  const [interval, setInterval] = React.useState(2);
  const [intervalUnit, setIntervalUnit] = React.useState<'days' | 'weeks' | 'months'>('days');
  const [selectedWeekdays, setSelectedWeekdays] = React.useState<number[]>([1, 3, 5]);
  const [ordinal, setOrdinal] = React.useState(1);
  const [ordinalWeekday, setOrdinalWeekday] = React.useState(1);
  const [monthDay, setMonthDay] = React.useState(15);

  // Determine current selection type
  const getCurrentPresetValue = (): RecurrenceType | 'none' => {
    if (!value) return 'none';
    if (value.type === 'custom') return 'custom';
    return value.type;
  };

  const handlePresetChange = (presetValue: string): void => {
    if (presetValue === 'none') {
      onChange(undefined);
      setShowCustom(false);
      return;
    }

    if (presetValue === 'custom') {
      setShowCustom(true);
      return;
    }

    const preset = RECURRENCE_PRESETS.find(p => p.value === presetValue);
    if (preset?.pattern) {
      onChange(preset.pattern);
      setShowCustom(false);
    }
  };

  const handleCustomApply = (): void => {
    let pattern: RecurrencePattern;

    switch (customType) {
      case 'interval':
        if (intervalUnit === 'days') {
          pattern = { type: interval === 1 ? 'daily' : 'custom', interval };
          if (interval > 1) pattern.type = 'custom';
        } else if (intervalUnit === 'weeks') {
          pattern = { type: interval === 1 ? 'weekly' : 'custom', interval };
          if (interval > 1) pattern.type = 'custom';
        } else {
          pattern = { type: interval === 1 ? 'monthly' : 'custom', interval };
          if (interval > 1) pattern.type = 'custom';
        }
        break;
      case 'weekdays':
        pattern = { type: 'custom', weekdays: selectedWeekdays.sort((a, b) => a - b) };
        break;
      case 'ordinal':
        pattern = { type: 'custom', ordinal, ordinalWeekday };
        break;
      case 'monthDay':
        pattern = { type: 'custom', monthDay };
        break;
      default:
        return;
    }

    onChange(pattern);
    setShowCustom(false);
  };

  const toggleWeekday = (day: number): void => {
    setSelectedWeekdays(prev => 
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const formattedValue = value ? formatRecurrencePattern(value) : 'No repeat';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showIcon && (
        <Repeat className="h-4 w-4 text-muted-foreground" />
      )}
      
      <Popover open={showCustom} onOpenChange={setShowCustom}>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-2">
            <Select
              value={getCurrentPresetValue()}
              onValueChange={handlePresetChange}
              disabled={disabled}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="No repeat" />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PopoverTrigger>

        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Custom Recurrence</h4>
            
            {/* Custom type selector */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={customType === 'interval' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCustomType('interval')}
              >
                Interval
              </Button>
              <Button
                variant={customType === 'weekdays' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCustomType('weekdays')}
              >
                Weekdays
              </Button>
              <Button
                variant={customType === 'ordinal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCustomType('ordinal')}
              >
                Ordinal
              </Button>
              <Button
                variant={customType === 'monthDay' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCustomType('monthDay')}
              >
                Day of Month
              </Button>
            </div>

            {/* Interval configuration */}
            {customType === 'interval' && (
              <div className="flex items-center gap-2">
                <span className="text-sm">Every</span>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={interval}
                  onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 h-8"
                />
                <Select value={intervalUnit} onValueChange={(v) => setIntervalUnit(v as typeof intervalUnit)}>
                  <SelectTrigger className="w-24 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">days</SelectItem>
                    <SelectItem value="weeks">weeks</SelectItem>
                    <SelectItem value="months">months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Weekdays configuration */}
            {customType === 'weekdays' && (
              <div className="space-y-2">
                <span className="text-sm">Repeat on:</span>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((day) => (
                    <Button
                      key={day.value}
                      variant={selectedWeekdays.includes(day.value) ? 'default' : 'outline'}
                      size="sm"
                      className="w-10 h-8 p-0"
                      onClick={() => toggleWeekday(day.value)}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Ordinal configuration */}
            {customType === 'ordinal' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm">Every</span>
                <Select value={String(ordinal)} onValueChange={(v) => setOrdinal(parseInt(v))}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDINALS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(ordinalWeekday)} onValueChange={(v) => setOrdinalWeekday(parseInt(v))}>
                  <SelectTrigger className="w-28 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.fullLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm">of the month</span>
              </div>
            )}

            {/* Month day configuration */}
            {customType === 'monthDay' && (
              <div className="flex items-center gap-2">
                <span className="text-sm">Every</span>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={monthDay}
                  onChange={(e) => setMonthDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-16 h-8"
                />
                <span className="text-sm">of the month</span>
              </div>
            )}

            {/* Apply button */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCustom(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCustomApply}
                disabled={customType === 'weekdays' && selectedWeekdays.length === 0}
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Human-readable preview */}
      {value && (
        <span className="text-xs text-muted-foreground">
          {formattedValue}
        </span>
      )}
    </div>
  );
}

export default RecurrenceSelector;
