'use client';

import * as React from 'react';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/** Common emoji categories for list customization */
const EMOJI_CATEGORIES = {
  'Objects': ['📁', '📂', '📋', '📝', '📌', '📎', '✏️', '📖', '📚', '💼', '🗂️', '🗃️'],
  'Activities': ['🎯', '🎨', '🎬', '🎮', '🎵', '🏃', '🚴', '🏋️', '⚽', '🎾', '🏀', '🎪'],
  'Places': ['🏠', '🏢', '🏫', '🏥', '🏪', '🏭', '✈️', '🚗', '🚀', '🌍', '🏖️', '⛰️'],
  'Symbols': ['⭐', '💡', '❤️', '🔥', '✨', '💎', '🎁', '🏆', '🔔', '💬', '📢', '🔒'],
  'Nature': ['🌸', '🌺', '🌻', '🌴', '🌲', '🍀', '🌈', '☀️', '🌙', '⚡', '❄️', '🌊'],
  'Food': ['☕', '🍕', '🍔', '🍎', '🍇', '🥗', '🍰', '🍩', '🥤', '🍺', '🍷', '🧁'],
};

export interface EmojiPickerProps {
  /** Currently selected emoji */
  value?: string;
  /** Callback when emoji changes */
  onChange: (emoji: string | undefined) => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Placeholder when no emoji is selected */
  placeholder?: string;
}

/**
 * EmojiPicker Component
 * Allows selection of emoji icons for list customization.
 * 
 * Requirements: 2.1, 2.4
 */
export function EmojiPicker({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = 'Pick emoji',
}: EmojiPickerProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<string>(Object.keys(EMOJI_CATEGORIES)[0]);

  const handleSelect = (emoji: string): void => {
    onChange(emoji);
    setOpen(false);
  };

  const handleClear = (): void => {
    onChange(undefined);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            'w-[100px] justify-start',
            !value && 'text-muted-foreground',
            className
          )}
        >
          {value ? (
            <span className="text-lg">{value}</span>
          ) : (
            <>
              <Smile className="h-4 w-4 mr-2" />
              {placeholder}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        {/* Category tabs */}
        <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b">
          {Object.keys(EMOJI_CATEGORIES).map((category) => (
            <Button
              key={category}
              variant={activeCategory === category ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Emoji grid */}
        <div className="grid grid-cols-6 gap-1">
          {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES].map((emoji) => (
            <Button
              key={emoji}
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 text-lg hover:bg-accent',
                value === emoji && 'bg-accent'
              )}
              onClick={() => handleSelect(emoji)}
            >
              {emoji}
            </Button>
          ))}
        </div>

        {/* Clear button */}
        {value && (
          <div className="mt-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="w-full"
            >
              Clear emoji
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default EmojiPicker;
