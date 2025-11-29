'use client';

import * as React from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Task } from '@/types';
import { format } from 'date-fns';

export interface SearchBarProps {
  /** Callback when search query changes */
  onSearch: (query: string) => void;
  /** Search results to display in dropdown */
  results?: Task[];
  /** Whether search is in progress */
  isLoading?: boolean;
  /** Callback when a result is selected */
  onResultSelect?: (task: Task) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class names */
  className?: string;
  /** Debounce delay in ms */
  debounceMs?: number;
}

/**
 * SearchBar Component
 * Fuzzy search input with results dropdown.
 * Clears results when query is empty (Requirement 17.4).
 * 
 * Requirements: 17.1, 17.4
 */
export function SearchBar({
  onSearch,
  results = [],
  isLoading = false,
  onResultSelect,
  placeholder = 'Search tasks...',
  className,
  debounceMs = 300,
}: SearchBarProps): React.ReactElement {
  const [query, setQuery] = React.useState('');
  const [showResults, setShowResults] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  // Handle click outside to close dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  const handleQueryChange = (value: string): void => {
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!value.trim()) {
      // Clear results immediately for empty query (Requirement 17.4)
      onSearch('');
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      onSearch(value.trim());
      setShowResults(true);
    }, debounceMs);
  };

  const handleClear = (): void => {
    setQuery('');
    onSearch('');
    setShowResults(false);
    inputRef.current?.focus();
  };

  const handleResultClick = (task: Task): void => {
    onResultSelect?.(task);
    setShowResults(false);
    setQuery('');
    onSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      setShowResults(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => query.trim() && results.length > 0 && setShowResults(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 pr-9"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!isLoading && query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {isLoading ? 'Searching...' : 'No results found'}
            </div>
          ) : (
            <ul className="py-1">
              {results.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className="w-full px-4 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                    onClick={() => handleResultClick(task)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        'text-sm truncate',
                        task.completed && 'line-through text-muted-foreground'
                      )}>
                        {task.name}
                      </span>
                      {task.date && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(task.date, 'MMM d')}
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {task.description}
                      </p>
                    )}
                    {task.labels && task.labels.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {task.labels.slice(0, 3).map((label) => (
                          <span
                            key={label.id}
                            className="text-xs bg-muted px-1.5 py-0.5 rounded"
                          >
                            {label.icon && <span className="mr-0.5">{label.icon}</span>}
                            {label.name}
                          </span>
                        ))}
                        {task.labels.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{task.labels.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
