'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { toast } from 'sonner';
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
  // For now, we'll calculate this client-side or add an API endpoint later
  // This is a placeholder that returns 0
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

/**
 * AppLayout Component
 * Main application layout with responsive sidebar and mobile support.
 * 
 * Requirements: 20.1, 20.2, 20.3
 * - Desktop: Split view layout with sidebar and main panel
 * - Mobile: Collapsible sidebar with swipe gestures
 * - Touch-friendly interactions for mobile devices
 */
export function AppLayout({ children, title }: AppLayoutProps) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [createListOpen, setCreateListOpen] = React.useState(false);
  const [createLabelOpen, setCreateLabelOpen] = React.useState(false);
  const [newListName, setNewListName] = React.useState('');
  const [newLabelName, setNewLabelName] = React.useState('');
  const dragControls = useDragControls();
  
  // Track touch start position for swipe detection
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
    refetchInterval: 60000, // Refresh every minute
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

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Handle swipe gestures for mobile sidebar
  React.useEffect(() => {
    const handleTouchStart = (e: TouchEvent): void => {
      touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent): void => {
      const touchEndX = e.changedTouches[0].clientX;
      const swipeDistance = touchEndX - touchStartX.current;
      const swipeThreshold = 50;

      // Swipe right from left edge to open sidebar
      if (touchStartX.current < 30 && swipeDistance > swipeThreshold && !mobileMenuOpen) {
        setMobileMenuOpen(true);
      }
      // Swipe left to close sidebar
      else if (swipeDistance < -swipeThreshold && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    // Only add listeners on mobile
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [mobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
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

  // Handle drag end for mobile sidebar
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): void => {
    // Close if dragged left more than 100px or velocity is high
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
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-black/50 lg:hidden touch-none"
                onClick={handleCloseMobileMenu}
              />
              
              {/* Sidebar Panel */}
              <motion.div
                ref={sidebarRef}
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                drag="x"
                dragControls={dragControls}
                dragConstraints={{ left: -256, right: 0 }}
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create List</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitList}>
              <Input
                placeholder="List name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                autoFocus
              />
              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateListOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!newListName.trim() || createListMutation.isPending}
                >
                  {createListMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Create Label Dialog */}
        <Dialog open={createLabelOpen} onOpenChange={setCreateLabelOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Label</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitLabel}>
              <Input
                placeholder="Label name"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                autoFocus
              />
              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateLabelOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!newLabelName.trim() || createLabelMutation.isPending}
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
