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
      <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl">
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
        'h-11 w-11 rounded-2xl',
        'hover:bg-primary/10 hover:scale-105 active:scale-95',
        'transition-all duration-300'
      )}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={isDark ? 'dark' : 'light'}
          initial={{ scale: 0, rotate: -180, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0, rotate: 180, opacity: 0 }}
          transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
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
  expanded?: boolean;
  onToggleExpand?: () => void;
}

function SearchBar({ expanded, onToggleExpand }: SearchBarProps): React.ReactElement {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

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

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-11 w-11 rounded-2xl sm:hidden hover:bg-primary/10',
          expanded && 'hidden'
        )}
        onClick={onToggleExpand}
      >
        <Search className="h-5 w-5" />
      </Button>

      <form 
        onSubmit={handleSubmit} 
        className={cn(
          'relative flex-1 max-w-xl hidden sm:flex',
          expanded && 'flex absolute inset-x-4 top-1/2 -translate-y-1/2 z-10 sm:relative sm:inset-auto sm:translate-y-0'
        )}
      >
        <motion.div 
          className="relative w-full"
          animate={{ scale: isFocused ? 1.02 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <Search className={cn(
            'absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-300',
            isFocused ? 'text-primary' : 'text-muted-foreground'
          )} />          <
Input
            ref={inputRef}
            type="search"
            placeholder="Search tasks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              'pl-12 pr-24 h-12 rounded-2xl',
              'input-aurora border-transparent',
              'placeholder:text-muted-foreground/50',
              'transition-all duration-300'
            )}
          />
          
          <div className={cn(
            'absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1.5',
            'text-xs text-muted-foreground/40',
            query && 'hidden'
          )}>
            <kbd className="flex h-6 items-center gap-1 rounded-lg border border-border/50 bg-muted/30 px-2 font-mono text-[10px]">
              <Command className="h-3 w-3" />K
            </kbd>
          </div>
          
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl"
              onClick={() => setQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </motion.div>
        
        {expanded && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 ml-2 sm:hidden rounded-2xl"
            onClick={onToggleExpand}
          >
            <X className="h-5 w-5" />
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

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden relative noise-overlay">
      {/* Aurora Background */}
      <div className="aurora-bg">
        <div className="aurora-orb aurora-orb-1" />
        <div className="aurora-orb aurora-orb-2" />
        <div className="aurora-orb aurora-orb-3" />
        <div className="aurora-orb aurora-orb-4" />
      </div>
      
      {/* Header */}
      <header className={cn(
        'relative flex h-20 items-center gap-4 px-4 sm:px-6 lg:px-8',
        'border-b border-border/20',
        'aurora-glass'
      )}>
        {showMenuButton && !searchExpanded && (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 lg:hidden shrink-0 rounded-2xl hover:bg-primary/10"
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
          onToggleExpand={() => setSearchExpanded(!searchExpanded)}
        />

        {!searchExpanded && (
          <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
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
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

export default MainPanel;