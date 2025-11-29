'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * ViewTransition component that enables smooth page transitions
 * using the View Transition API when supported.
 * Falls back gracefully on unsupported browsers.
 */
export function ViewTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // Check if View Transition API is supported
    if (!document.startViewTransition) {
      return;
    }

    // Add view-transition-name to main content for smooth transitions
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.style.viewTransitionName = 'main-content';
    }
  }, [pathname]);

  return <>{children}</>;
}

/**
 * Hook to trigger view transitions programmatically
 */
export function useViewTransition() {
  const startTransition = (callback: () => void | Promise<void>) => {
    if (document.startViewTransition) {
      document.startViewTransition(callback);
    } else {
      // Fallback for browsers without View Transition API support
      callback();
    }
  };

  return { startTransition };
}
