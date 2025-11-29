'use client';

import * as React from 'react';
import { format } from 'date-fns';
import {
  Calendar,
  Clock,
  Flag,
  FolderOpen,
  Sparkles,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { ParsedTaskInput, Priority, List } from '@/types';
import { parse as parseNaturalLanguage } from '@/lib/services/nlp-parser.service';

interface NaturalLanguageInputProps {
  lists?: List[];
  onCreateTask: (parsed: ParsedTaskInput) => void;
  onCancel?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

const priorityLabels: Record<Priority, { label: string; color: string }> = {
  high: { label: 'High', color: 'text-red-500 bg-red-500/10' },
  medium: { label: 'Medium', color: 'text-yellow-500 bg-yellow-500/10' },
  low: { label: 'Low', color: 'text-blue-500 bg-blue-500/10' },
  none: { label: 'None', color: 'text-muted-foreground' },
};

/**
 * NaturalLanguageInput Component
 * Text input with parsing preview and confirmation before task creation.
 * 
 * Requirements: 28.1, 28.4
 */
export function NaturalLanguageInput({
  lists = [],
  onCreateTask,
  onCancel,
  placeholder = 'Add task... (e.g., "Meeting with Sarah tomorrow at 2pm urgent")',
  className,
  autoFocus = false,
}: NaturalLanguageInputProps) {
  const [input, setInput] = React.useState('');
  const [parsed, setParsed] = React.useState<ParsedTaskInput | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Parse input on change with debounce
  React.useEffect(() => {
    if (!input.trim()) {
      setParsed(null);
      setShowPreview(false);
      return;
    }

    const timer = setTimeout(() => {
      const result = parseNaturalLanguage(input);
      setParsed(result);
      setShowPreview(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!parsed || !parsed.name.trim()) return;

    onCreateTask(parsed);
    setInput('');
    setParsed(null);
    setShowPreview(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showPreview) {
        setShowPreview(false);
      } else {
        onCancel?.();
      }
    }
  };

  const handleConfirm = () => {
    if (!parsed || !parsed.name.trim()) return;
    onCreateTask(parsed);
    setInput('');
    setParsed(null);
    setShowPreview(false);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setInput('');
    setParsed(null);
    setShowPreview(false);
    inputRef.current?.focus();
  };

  // Find matching list from parsed listName
  const parsedListName = parsed?.listName;
  const matchedList = React.useMemo(() => {
    if (!parsedListName || lists.length === 0) return null;
    const lowerName = parsedListName.toLowerCase();
    return lists.find(l => l.name.toLowerCase() === lowerName);
  }, [parsedListName, lists]);

  const hasExtractedData = parsed && (
    parsed.date ||
    parsed.time ||
    parsed.priority ||
    parsed.listName
  );

  return (
    <div className={cn('space-y-2', className)}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <Sparkles className="absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="pl-9 pr-20"
            autoFocus={autoFocus}
          />
          {input && (
            <div className="absolute right-2 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary"
                disabled={!parsed?.name.trim()}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </form>

      {/* Parsing Preview */}
      {showPreview && parsed && parsed.name && (
        <div className="rounded-lg border bg-card p-3 space-y-3 animate-in fade-in-50 slide-in-from-top-2">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 flex-1">
              <p className="text-sm font-medium">{parsed.name}</p>
              
              {hasExtractedData && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Date */}
                  {parsed.date && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(parsed.date, 'MMM d, yyyy')}
                    </span>
                  )}

                  {/* Time */}
                  {parsed.time && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {parsed.time}
                    </span>
                  )}

                  {/* Priority */}
                  {parsed.priority && parsed.priority !== 'none' && (
                    <Badge
                      variant="secondary"
                      className={cn('text-xs', priorityLabels[parsed.priority].color)}
                    >
                      <Flag className="h-3 w-3 mr-1" />
                      {priorityLabels[parsed.priority].label}
                    </Badge>
                  )}

                  {/* List */}
                  {parsed.listName && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <FolderOpen className="h-3 w-3" />
                      {matchedList ? (
                        <>
                          {matchedList.emoji && <span>{matchedList.emoji}</span>}
                          {matchedList.name}
                        </>
                      ) : (
                        <span className="text-yellow-500">{parsed.listName} (not found)</span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Confirmation buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={!parsed.name.trim()}
            >
              Create Task
            </Button>
          </div>
        </div>
      )}

      {/* Help text */}
      {!showPreview && !input && (
        <p className="text-xs text-muted-foreground px-1">
          Try: &quot;Buy groceries tomorrow&quot;, &quot;Call mom at 3pm urgent&quot;, &quot;Review PR in Work&quot;
        </p>
      )}
    </div>
  );
}

export default NaturalLanguageInput;
