'use client';

import * as React from 'react';
import { Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Priority } from '@/types';

/** Priority option configuration */
interface PriorityOption {
  value: Priority;
  label: string;
  color: string;
  bgColor: string;
}

/** Available priority options with visual styling */
const PRIORITY_OPTIONS: PriorityOption[] = [
  { 
    value: 'high', 
    label: 'High', 
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  { 
    value: 'medium', 
    label: 'Medium', 
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
  { 
    value: 'low', 
    label: 'Low', 
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  { 
    value: 'none', 
    label: 'None', 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
  },
];

export interface PrioritySelectorProps {
  /** Currently selected priority */
  value: Priority;
  /** Callback when priority changes */
  onChange: (priority: Priority) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Additional class names for the trigger */
  className?: string;
  /** Whether to show the flag icon */
  showIcon?: boolean;
  /** Size variant */
  size?: 'sm' | 'default';
}

/**
 * Gets the priority option configuration for a given priority value
 */
export function getPriorityOption(priority: Priority): PriorityOption {
  return PRIORITY_OPTIONS.find(p => p.value === priority) ?? PRIORITY_OPTIONS[3];
}

/**
 * PrioritySelector Component
 * Visual priority selector with distinct color indicators for each level.
 * 
 * Requirements: 9.1, 9.2
 */
export function PrioritySelector({
  value,
  onChange,
  disabled = false,
  className,
  showIcon = true,
  size = 'default',
}: PrioritySelectorProps): React.ReactElement {
  const currentOption = getPriorityOption(value);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showIcon && (
        <Flag className={cn('h-4 w-4', currentOption.color)} />
      )}
      <Select
        value={value}
        onValueChange={(v) => onChange(v as Priority)}
        disabled={disabled}
      >
        <SelectTrigger 
          className={cn(
            'w-[140px]',
            size === 'sm' && 'h-8'
          )}
        >
          <SelectValue>
            <span className={currentOption.color}>{currentOption.label}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  option.value === 'high' && 'bg-red-500',
                  option.value === 'medium' && 'bg-yellow-500',
                  option.value === 'low' && 'bg-blue-500',
                  option.value === 'none' && 'bg-muted-foreground'
                )} />
                <span className={option.color}>{option.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * PriorityBadge Component
 * Compact visual indicator for displaying priority without selection capability.
 */
export interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
  showLabel?: boolean;
}

export function PriorityBadge({
  priority,
  className,
  showLabel = false,
}: PriorityBadgeProps): React.ReactElement | null {
  if (priority === 'none') {
    return null;
  }

  const option = getPriorityOption(priority);

  return (
    <div className={cn(
      'flex items-center gap-1',
      option.bgColor,
      'px-1.5 py-0.5 rounded text-xs',
      className
    )}>
      <Flag className={cn('h-3 w-3', option.color)} />
      {showLabel && (
        <span className={option.color}>{option.label}</span>
      )}
    </div>
  );
}

export default PrioritySelector;
