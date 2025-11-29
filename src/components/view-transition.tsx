'use client';

import { useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Type for View Transition API result
 */
interface ViewTransitionResult {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition: () => void;
}

/**
 * Check if View Transition API is supported
 */
export function isViewTransitionSupported(): boolean {
  return typeof document !== 'undefined' && 'startViewTransition' in document;
}

/**
 * ViewTransition component that enables smooth page transitions
 * using the View Transition API when supported.
 * Falls back gracefully on unsupported browsers.
 * 
 * Requirements: 21.1, 21.2
 */
export function ViewTransition({ children }: { children: React.ReactNode }): React.ReactElement {
  const pathname = usePathname();
  const previousPathRef = useRef<string>(pathname);

  useEffect(() => {
    // Skip if same path or API not supported
    if (previousPathRef.current === pathname || !isViewTransitionSupported()) {
      previousPathRef.current = pathname;
      return;
    }

    // Add view-transition-name to main content for smooth transitions
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.style.viewTransitionName = 'main-content';
    }

    // Add view-transition-name to sidebar for independent animation
    const sidebar = document.querySelector('aside');
    if (sidebar) {
      sidebar.style.viewTransitionName = 'sidebar';
    }

    previousPathRef.current = pathname;
  }, [pathname]);

  return <>{children}</>;
}

/**
 * Hook to trigger view transitions programmatically
 * Provides a consistent API whether View Transition is supported or not.
 * 
 * Requirements: 21.1, 21.2
 */
export function useViewTransition(): {
  startTransition: (callback: () => void | Promise<void>) => Promise<void>;
  isSupported: boolean;
} {
  const isSupported = isViewTransitionSupported();

  const startTransition = useCallback(async (callback: () => void | Promise<void>): Promise<void> => {
    // Type assertion for View Transition API
    const doc = document as Document & {
      startViewTransition?: (cb: () => void | Promise<void>) => ViewTransitionResult;
    };
    
    if (isSupported && doc.startViewTransition) {
      const transition = doc.startViewTransition(callback);
      await transition.finished;
    } else {
      // Fallback for browsers without View Transition API support
      await callback();
    }
  }, [isSupported]);

  return { startTransition, isSupported };
}

/**
 * Hook to apply view transition names to elements
 * Useful for animating specific elements during page transitions.
 */
export function useViewTransitionName(
  ref: React.RefObject<HTMLElement | null>,
  name: string
): void {
  useEffect(() => {
    if (!ref.current || !isViewTransitionSupported()) return;
    
    ref.current.style.viewTransitionName = name;
    
    return () => {
      if (ref.current) {
        ref.current.style.viewTransitionName = '';
      }
    };
  }, [ref, name]);
}
