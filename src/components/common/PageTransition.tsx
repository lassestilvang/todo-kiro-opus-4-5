'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { pageTransitionVariants } from '@/lib/utils/animations';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * PageTransition Component
 * Wraps page content with Framer Motion animations for smooth transitions.
 * Works alongside the View Transition API for enhanced page navigation.
 * 
 * Requirements: 21.1, 21.2
 */
export function PageTransition({ children, className }: PageTransitionProps): React.ReactElement {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        variants={pageTransitionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * FadeTransition Component
 * Simple fade transition for content that doesn't need slide effects.
 */
export function FadeTransition({ children, className }: PageTransitionProps): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * SlideTransition Component
 * Slide transition for content panels and drawers.
 */
interface SlideTransitionProps extends PageTransitionProps {
  direction?: 'left' | 'right' | 'up' | 'down';
}

export function SlideTransition({ 
  children, 
  className,
  direction = 'right' 
}: SlideTransitionProps): React.ReactElement {
  const directionMap = {
    left: { x: -20, y: 0 },
    right: { x: 20, y: 0 },
    up: { x: 0, y: -20 },
    down: { x: 0, y: 20 },
  };

  const offset = directionMap[direction];

  return (
    <motion.div
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, ...offset }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
