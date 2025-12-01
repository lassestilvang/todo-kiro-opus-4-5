'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { MainPanel } from './MainPanel';
import { ErrorBoundary, SidebarSkeleton } from '@/components/common';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { List, Label, CreateListInput, CreateLabelInput } from '@/types';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

async function fetchLists(): Promise<List[]> {
  const res = await fetch('/api/lists');
  if (!res.ok) throw new Error('Failed to fetch lists');
  return res.json();
}

async function fetchLabels(): Promise<Label[]> {
  const res = await fetch('/api/labels');
  if (!res.ok) throw new Error('Failed to fetch labels');
  return res.json();
}

async function fetchOverdueCount(): Promise<number> {
  return 0;
}

async function createList(data: CreateListInput): Promise<List> {
  const res = await fetch('/api/lists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to create list');
  }
  return res.json();
}

async function createLabel(data: CreateLabelInput): Promise<Label> {
  const res = await fetch('/api/labels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to create label');
  }
  return res.json();
}

export function AppLayout({ children, title }: AppLayoutProps): React.ReactElement {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [createListOpen, setCreateListOpen] = React.useState(false);
  const [createLabelOpen, setCreateLabelOpen] = React.useState(false);
  const [newListName, setNewListName] = React.useState('');
  const [newLabelName, setNewLabelName] = React.useState('');
  
  const touchStartX = React.useRef<number>(0);
  const sidebarRef = React.useRef<HTMLDivElement>(null);

  const { data: lists = [], isLoading: listsLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: fetchLists,
  });

  const { data: labels = [], isLoading: labelsLoading } = useQuery({
    queryKey: ['labels'],
    queryFn: fetchLabels,
  });

  const { data: overdueCount = 0 } = useQuery({
    queryKey: ['overdueCount'],
    queryFn: fetchOverdueCount,
    refetchInterval: 60000,
  });

  const createListMutation = useMutation({
    mutationFn: createList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      setCreateListOpen(false);
      setNewListName('');
      toast.success('List created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const createLabelMutation = useMutation({
    mutationFn: createLabel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
      setCreateLabelOpen(false);
      setNewLabelName('');
      toast.success('Label created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const handleTouchStart = (e: TouchEvent): void => {
      touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent): void => {
      const touchEndX = e.changedTouches[0].clientX;
      const swipeDistance = touchEndX - touchStartX.current;
      const swipeThreshold = 50;

      if (touchStartX.current < 30 && swipeDistance > swipeThreshold && !mobileMenuOpen) {
        setMobileMenuOpen(true);
      } else if (swipeDistance < -swipeThreshold && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [mobileMenuOpen]);

  React.useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleToggleSidebar = (): void => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleMobileMenuClick = (): void => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleCloseMobileMenu = (): void => {
    setMobileMenuOpen(false);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): void => {
    if (info.offset.x < -100 || info.velocity.x < -500) {
      setMobileMenuOpen(false);
    }
  };

  const handleCreateList = (): void => {
    setCreateListOpen(true);
  };

  const handleCreateLabel = (): void => {
    setCreateLabelOpen(true);
  };

  const handleSubmitList = (e: React.FormEvent): void => {
    e.preventDefault();
    if (newListName.trim()) {
      createListMutation.mutate({ name: newListName.trim() });
    }
  };

  const handleSubmitLabel = (e: React.FormEvent): void => {
    e.preventDefault();
    if (newLabelName.trim()) {
      createLabelMutation.mutate({ name: newLabelName.trim() });
    }
  };

  const sidebarLoading = listsLoading || labelsLoading;

  return (
    <ErrorBoundary>
      <div className="flex h-dvh overflow-hidden bg-background">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          {sidebarLoading ? (
            <SidebarSkeleton collapsed={sidebarCollapsed} />
          ) : (
            <Sidebar
              lists={lists}
              labels={labels}
              overdueCount={overdueCount}
              collapsed={sidebarCollapsed}
              onToggleCollapse={handleToggleSidebar}
              onCreateList={handleCreateList}
              onCreateLabel={handleCreateLabel}
            />
          )}
        </div>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Backdrop with blur */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden touch-none"
                onClick={handleCloseMobileMenu}
              />
              
              {/* Sidebar Panel */}
              <motion.div
                ref={sidebarRef}
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                drag="x"
                dragConstraints={{ left: -280, right: 0 }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                className="fixed inset-y-0 left-0 z-50 lg:hidden touch-pan-y"
              >
                {sidebarLoading ? (
                  <SidebarSkeleton collapsed={false} />
                ) : (
                  <Sidebar
                    lists={lists}
                    labels={labels}
                    overdueCount={overdueCount}
                    collapsed={false}
                    onToggleCollapse={handleCloseMobileMenu}
                    onCreateList={handleCreateList}
                    onCreateLabel={handleCreateLabel}
                    isMobile
                  />
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <MainPanel
          title={title}
          showMenuButton
          onMenuClick={handleMobileMenuClick}
        >
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </MainPanel>

        {/* Create List Dialog */}
        <Dialog open={createListOpen} onOpenChange={setCreateListOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Create List
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitList} className="space-y-4">
              <Input
                placeholder="List name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="h-11 rounded-xl bg-muted/50 border-transparent focus:border-primary/30"
                autoFocus
              />
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateListOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!newListName.trim() || createListMutation.isPending}
                  className={cn(
                    'rounded-xl',
                    'bg-gradient-to-r from-primary to-accent',
                    'text-white font-medium'
                  )}
                >
                  {createListMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Create Label Dialog */}
        <Dialog open={createLabelOpen} onOpenChange={setCreateLabelOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Create Label
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitLabel} className="space-y-4">
              <Input
                placeholder="Label name"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                className="h-11 rounded-xl bg-muted/50 border-transparent focus:border-primary/30"
                autoFocus
              />
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateLabelOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!newLabelName.trim() || createLabelMutation.isPending}
                  className={cn(
                    'rounded-xl',
                    'bg-gradient-to-r from-primary to-accent',
                    'text-white font-medium'
                  )}
                >
                  {createLabelMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}

export default AppLayout;
