'use client';

import * as React from 'react';
import { Palette, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/** Predefined color palette for list customization */
const COLOR_PALETTE = [
  // Reds
  { value: '#ef4444', name: 'Red' },
  { value: '#f97316', name: 'Orange' },
  { value: '#f59e0b', name: 'Amber' },
  // Yellows/Greens
  { value: '#eab308', name: 'Yellow' },
  { value: '#84cc16', name: 'Lime' },
  { value: '#22c55e', name: 'Green' },
  // Teals/Blues
  { value: '#14b8a6', name: 'Teal' },
  { value: '#06b6d4', name: 'Cyan' },
  { value: '#0ea5e9', name: 'Sky' },
  // Blues/Purples
  { value: '#3b82f6', name: 'Blue' },
  { value: '#6366f1', name: 'Indigo' },
  { value: '#8b5cf6', name: 'Violet' },
  // Purples/Pinks
  { value: '#a855f7', name: 'Purple' },
  { value: '#d946ef', name: 'Fuchsia' },
  { value: '#ec4899', name: 'Pink' },
  // Neutrals
  { value: '#f43f5e', name: 'Rose' },
  { value: '#64748b', name: 'Slate' },
  { value: '#78716c', name: 'Stone' },
];

export interface ColorPickerProps {
  /** Currently selected color (hex value) */
  value?: string;
  /** Callback when color changes */
  onChange: (color: string | undefined) => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Placeholder when no color is selected */
  placeholder?: string;
}

/**
 * ColorPicker Component
 * Allows selection of colors for list customization.
 * 
 * Requirements: 2.1, 2.4
 */
export function ColorPicker({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = 'Pick color',
}: ColorPickerProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (color: string): void => {
    onChange(color);
    setOpen(false);
  };

  const handleClear = (): void => {
    onChange(undefined);
    setOpen(false);
  };

  const selectedColor = COLOR_PALETTE.find(c => c.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            'w-[120px] justify-start gap-2',
            !value && 'text-muted-foreground',
            className
          )}
        >
          {value ? (
            <>
              <div
                className="h-4 w-4 rounded-full border"
                style={{ backgroundColor: value }}
              />
              <span className="truncate">{selectedColor?.name ?? 'Custom'}</span>
            </>
          ) : (
            <>
              <Palette className="h-4 w-4" />
              {placeholder}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <p className="text-sm font-medium">Choose a color</p>
          
          {/* Color grid */}
          <div className="grid grid-cols-6 gap-2">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color.value}
                type="button"
                className={cn(
                  'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  value === color.value ? 'border-foreground' : 'border-transparent'
                )}
                style={{ backgroundColor: color.value }}
                onClick={() => handleSelect(color.value)}
                title={color.name}
              >
                {value === color.value && (
                  <Check className="h-4 w-4 mx-auto text-white drop-shadow-md" />
                )}
              </button>
            ))}
          </div>

          {/* Clear button */}
          {value && (
            <div className="pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="w-full"
              >
                Clear color
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * ColorDot Component
 * Simple color indicator dot for displaying list colors.
 */
export interface ColorDotProps {
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ColorDot({
  color,
  size = 'md',
  className,
}: ColorDotProps): React.ReactElement | null {
  if (!color) return null;

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  return (
    <div
      className={cn(
        'rounded-full shrink-0',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: color }}
    />
  );
}

export default ColorPicker;
