'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { MainPanel } from './MainPanel';
import { ErrorBoundary, SidebarSkeleton } from '@/components/common';
import type { List, Label } from '@/types';

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
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
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
      </div>
    </ErrorBoundary>
  );
}

export default AppLayout;
