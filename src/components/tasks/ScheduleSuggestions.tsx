'use client';

import * as React from 'react';
import { format, isToday as isTodayFn, isTomorrow as isTomorrowFn } from 'date-fns';
import { Sparkles, Clock, Calendar, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ScheduleSuggestion, Task } from '@/types';

interface ScheduleSuggestionsProps {
  /** Task data used to generate suggestions (needs estimate) */
  taskData: Partial<Task>;
  /** Callback when user accepts a suggestion */
  onAcceptSuggestion: (suggestion: ScheduleSuggestion) => void;
  /** Whether suggestions are currently loading */
  isLoading?: boolean;
  /** Optional class name */
  className?: string;
}

/**
 * Fetches scheduling suggestions from the API
 */
async function fetchScheduleSuggestions(
  estimate: number,
  priority: string,
  deadline?: Date
): Promise<ScheduleSuggestion[]> {
  const params = new URLSearchParams({
    estimate: String(estimate),
    priority,
  });
  
  if (deadline) {
    params.append('deadline', deadline.toISOString());
  }

  const res = await fetch(`/api/tasks/schedule-suggestions?${params}`);
  if (!res.ok) {
    throw new Error('Failed to fetch schedule suggestions');
  }
  
  const data = await res.json();
  return data.map((s: ScheduleSuggestion) => ({
    ...s,
    startTime: new Date(s.startTime),
    endTime: new Date(s.endTime),
  }));
}

/**
 * Returns a color class based on the suggestion score
 */
function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-orange-500';
}

/**
 * Returns a badge variant based on the suggestion score
 */
function getScoreBadgeVariant(score: number): 'default' | 'secondary' | 'outline' {
  if (score >= 70) return 'default';
  if (score >= 50) return 'secondary';
  return 'outline';
}

/**
 * ScheduleSuggestions Component
 * Displays smart scheduling suggestions when creating an unscheduled task with an estimate.
 * Shows ranked options with reasons and allows accepting a suggestion.
 * 
 * Requirements: 29.1, 29.4, 29.5
 */
export function ScheduleSuggestions({
  taskData,
  onAcceptSuggestion,
  isLoading: externalLoading = false,
  className,
}: ScheduleSuggestionsProps): React.ReactElement | null {
  const [suggestions, setSuggestions] = React.useState<ScheduleSuggestion[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [hasFetched, setHasFetched] = React.useState(false);

  // Determine if we should show suggestions
  // Show when: has estimate, no date set
  const shouldShowSuggestions = !!(taskData.estimate && taskData.estimate > 0 && !taskData.date);

  // Fetch suggestions when conditions are met
  React.useEffect(() => {
    if (!shouldShowSuggestions) {
      setSuggestions([]);
      setHasFetched(false);
      return;
    }

    // Avoid re-fetching if we already have suggestions for this estimate
    if (hasFetched) return;

    const fetchSuggestions = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      
      try {
        const results = await fetchScheduleSuggestions(
          taskData.estimate!,
          taskData.priority || 'none',
          taskData.deadline
        );
        setSuggestions(results);
        setHasFetched(true);
      } catch (err) {
        setError('Unable to load scheduling suggestions');
        console.error('Failed to fetch schedule suggestions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [shouldShowSuggestions, taskData.estimate, taskData.priority, taskData.deadline, hasFetched]);

  // Reset hasFetched when estimate changes
  React.useEffect(() => {
    setHasFetched(false);
  }, [taskData.estimate]);

  // Don't render if conditions aren't met
  if (!shouldShowSuggestions) {
    return null;
  }

  const loading = isLoading || externalLoading;

  return (
    <div className={cn('rounded-lg border bg-muted/30 p-3 sm:p-4', className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Smart Scheduling Suggestions</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Finding available time slots...
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive py-2">{error}</p>
          )}

          {!loading && !error && suggestions.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No available time slots found in the next 7 days.
            </p>
          )}

          {!loading && !error && suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Based on your schedule and task priority:
              </p>
              
              {suggestions.map((suggestion, index) => (
                <SuggestionItem
                  key={`${suggestion.startTime.toISOString()}-${index}`}
                  suggestion={suggestion}
                  rank={index + 1}
                  onAccept={() => onAcceptSuggestion(suggestion)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SuggestionItemProps {
  suggestion: ScheduleSuggestion;
  rank: number;
  onAccept: () => void;
}

/**
 * Individual suggestion item with accept action
 */
function SuggestionItem({ suggestion, rank, onAccept }: SuggestionItemProps): React.ReactElement {
  const { startTime, endTime, score, reason } = suggestion;
  
  const dateStr = format(startTime, 'EEE, MMM d');
  const timeStr = `${format(startTime, 'h:mm a')} - ${format(endTime, 'h:mm a')}`;
  const isToday = isTodayFn(startTime);
  const isTomorrow = isTomorrowFn(startTime);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-md bg-background border hover:border-primary/50 transition-colors">
      {/* Rank indicator */}
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-xs font-medium text-muted-foreground w-4">
          #{rank}
        </span>
        
        {/* Score badge */}
        <Badge 
          variant={getScoreBadgeVariant(score)} 
          className="text-xs px-1.5 py-0.5"
        >
          <span className={cn('font-medium', getScoreColor(score))}>
            {score}%
          </span>
        </Badge>
      </div>

      {/* Date and time info */}
      <div className="flex-1 min-w-0 ml-6 sm:ml-0">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-medium">
            {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : dateStr}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{timeStr}</span>
        </div>
        {reason && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {reason}
          </p>
        )}
      </div>

      {/* Accept button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAccept}
        className="h-8 px-3 shrink-0 self-end sm:self-center"
      >
        <Check className="h-3.5 w-3.5 mr-1" />
        Accept
      </Button>
    </div>
  );
}

export default ScheduleSuggestions;
