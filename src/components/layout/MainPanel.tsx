'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sun, Moon, Menu, X, Command, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MainPanelProps {
  children: React.ReactNode;
  title?: string;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

function ThemeToggle(): React.ReactElement {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl">
        <Sun className="h-5 w-5" />
      </Button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'h-10 w-10 rounded-xl transition-all duration-300',
        'hover:bg-primary/10 hover:scale-105',
        'active:scale-95'
      )}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={isDark ? 'dark' : 'light'}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, rotate: 180 }}
          transition={{ duration: 0.3 }}
        >
          {isDark ? (
            <Sun className="h-5 w-5 text-amber-400" />
          ) : (
            <Moon className="h-5 w-5 text-primary" />
          )}
        </motion.div>
      </AnimatePresence>
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

function SearchBar({ 
  placeholder = 'Search tasks...', 
  expanded, 
  onToggleExpand 
}: SearchBarProps): React.ReactElement {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  // Keyboard shortcut
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleClear = (): void => {
    setQuery('');
    onToggleExpand?.();
  };

  return (
    <>
      {/* Mobile search icon */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-10 w-10 rounded-xl sm:hidden',
          'hover:bg-primary/10',
          expanded && 'hidden'
        )}
        onClick={onToggleExpand}
      >
        <Search className="h-5 w-5" />
        <span className="sr-only">Search</span>
      </Button>

      {/* Search input */}
      <form 
        onSubmit={handleSubmit} 
        className={cn(
          'relative flex-1 max-w-lg',
          'hidden sm:flex',
          expanded && 'flex absolute inset-x-0 top-0 h-16 items-center bg-background/95 backdrop-blur-xl px-4 z-10 sm:relative sm:inset-auto sm:h-auto sm:px-0 sm:bg-transparent sm:backdrop-blur-none'
        )}
      >
        <motion.div 
          className="relative w-full"
          animate={{ 
            scale: isFocused ? 1.02 : 1,
          }}
          transition={{ duration: 0.2 }}
        >
          <Search className={cn(
            'absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-200',
            isFocused ? 'text-primary' : 'text-muted-foreground'
          )} />
          <Input
            ref={inputRef}
            type="search"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              'pl-11 pr-20 h-11 rounded-xl',
              'bg-muted/50 border-transparent',
              'placeholder:text-muted-foreground/60',
              'transition-all duration-300',
              'focus:bg-background focus:border-primary/30 focus:shadow-lg focus:shadow-primary/10',
              expanded && 'flex-1 sm:flex-initial'
            )}
          />
          
          {/* Keyboard shortcut hint */}
          <div className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1',
            'text-xs text-muted-foreground/50',
            query && 'hidden'
          )}>
            <kbd className="flex h-5 items-center gap-0.5 rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px]">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
          
          {/* Clear button */}
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg"
              onClick={() => setQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </motion.div>
        
        {/* Mobile close button */}
        {expanded && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 ml-2 sm:hidden rounded-xl"
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

export function MainPanel({
  children,
  title,
  onMenuClick,
  showMenuButton = false,
}: MainPanelProps): React.ReactElement {
  const [searchExpanded, setSearchExpanded] = React.useState(false);

  const handleToggleSearch = (): void => {
    setSearchExpanded(!searchExpanded);
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden relative">
      {/* Ambient background */}
      <div className="ambient-bg">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
      </div>
      
      {/* Header */}
      <header className={cn(
        'relative flex h-16 items-center gap-3 sm:gap-4 px-4 sm:px-6 lg:px-8',
        'border-b border-border/30',
        'glass-subtle'
      )}>
        {showMenuButton && !searchExpanded && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 lg:hidden shrink-0 rounded-xl hover:bg-primary/10"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        )}
        
        {title && !searchExpanded && (
          <motion.h2 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg font-semibold lg:hidden truncate gradient-text"
          >
            {title}
          </motion.h2>
        )}

        <SearchBar 
          expanded={searchExpanded}
          onToggleExpand={handleToggleSearch}
        />

        {!searchExpanded && (
          <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
            <ThemeToggle />
          </div>
        )}
      </header>

      {/* Content Area */}
      <main className={cn(
        'relative flex-1 overflow-y-auto',
        'p-4 sm:p-6 lg:p-8',
        'overscroll-contain'
      )}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

export default MainPanel;
