'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Search, Sun, Moon, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MainPanelProps {
  children: React.ReactNode;
  title?: string;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
        <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
      </Button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 sm:h-10 sm:w-10"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? (
        <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
      ) : (
        <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

/**
 * SearchBar Component
 * Responsive search bar that collapses to icon on mobile.
 * 
 * Requirements: 17.1, 20.2
 */
function SearchBar({ onSearch, placeholder = 'Search tasks...', expanded, onToggleExpand }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      onSearch?.(query);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setQuery(value);
  };

  const handleClear = (): void => {
    setQuery('');
    onToggleExpand?.();
  };

  // Mobile: show icon button that expands to full search
  return (
    <>
      {/* Mobile search icon */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-9 w-9 sm:hidden',
          expanded && 'hidden'
        )}
        onClick={onToggleExpand}
      >
        <Search className="h-5 w-5" />
        <span className="sr-only">Search</span>
      </Button>

      {/* Expanded mobile search / Desktop search */}
      <form 
        onSubmit={handleSubmit} 
        className={cn(
          'relative flex-1 max-w-md',
          // Mobile: hidden by default, shown when expanded
          'hidden sm:flex',
          expanded && 'flex absolute inset-x-0 top-0 h-14 items-center bg-background px-4 z-10 sm:relative sm:inset-auto sm:h-auto sm:px-0'
        )}
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          className={cn(
            'pl-9 h-9',
            // Mobile expanded: full width
            expanded && 'flex-1 sm:flex-initial'
          )}
        />
        {/* Mobile: close button when expanded */}
        {expanded && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 ml-2 sm:hidden"
            onClick={handleClear}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close search</span>
          </Button>
        )}
      </form>
    </>
  );
}

/**
 * MainPanel Component
 * Main content area with responsive header.
 * 
 * Requirements: 17.1, 19.2, 20.1, 20.2
 */
export function MainPanel({
  children,
  title,
  onMenuClick,
  showMenuButton = false,
}: MainPanelProps) {
  const [searchExpanded, setSearchExpanded] = React.useState(false);

  const handleSearch = (_query: string): void => {
    // Search functionality is handled by navigation to search page
  };

  const handleToggleSearch = (): void => {
    setSearchExpanded(!searchExpanded);
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className={cn(
        'flex h-14 items-center gap-2 sm:gap-4 border-b bg-background px-3 sm:px-4 lg:px-6',
        'relative' // For absolute positioned mobile search
      )}>
        {showMenuButton && !searchExpanded && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 lg:hidden shrink-0"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        )}
        
        {title && !searchExpanded && (
          <h2 className="text-lg font-semibold lg:hidden truncate">{title}</h2>
        )}

        <SearchBar 
          onSearch={handleSearch} 
          expanded={searchExpanded}
          onToggleExpand={handleToggleSearch}
        />

        {!searchExpanded && (
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto sm:ml-0">
            <ThemeToggle />
          </div>
        )}
      </header>

      {/* Content Area */}
      <main className={cn(
        'flex-1 overflow-y-auto',
        'p-3 sm:p-4 lg:p-6',
        // Better touch scrolling
        'overscroll-contain'
      )}>
        {children}
      </main>
    </div>
  );
}

export default MainPanel;
