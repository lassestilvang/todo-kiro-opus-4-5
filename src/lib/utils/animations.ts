/**
 * Animation utilities and variants for Framer Motion
 * Provides consistent animations across the application.
 * 
 * Requirements: 21.1
 */

import type { Variants, Transition } from 'framer-motion';

/**
 * Standard easing curves
 */
export const easings = {
  easeOut: [0.16, 1, 0.3, 1] as const,
  easeIn: [0.4, 0, 1, 1] as const,
  easeInOut: [0.4, 0, 0.2, 1] as const,
  spring: { type: 'spring', damping: 25, stiffness: 300 } as const,
};

/**
 * Standard durations
 */
export const durations = {
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
};

/**
 * Fade animation variants
 */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: durations.normal },
  },
  exit: { 
    opacity: 0,
    transition: { duration: durations.fast },
  },
};

/**
 * Slide up animation variants
 */
export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: durations.normal,
      ease: easings.easeOut,
    },
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: { duration: durations.fast },
  },
};

/**
 * Slide in from left animation variants
 */
export const slideLeftVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { 
      duration: durations.normal,
      ease: easings.easeOut,
    },
  },
  exit: { 
    opacity: 0, 
    x: -20,
    transition: { duration: durations.fast },
  },
};

/**
 * Scale animation variants (for modals/dialogs)
 */
export const scaleVariants: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: easings.spring,
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: durations.fast },
  },
};

/**
 * Stagger container variants for lists
 */
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

/**
 * Stagger item variants for list items
 */
export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: durations.normal,
      ease: easings.easeOut,
    },
  },
  exit: { 
    opacity: 0, 
    x: -20,
    transition: { duration: durations.fast },
  },
};

/**
 * Collapse animation variants
 */
export const collapseVariants: Variants = {
  hidden: { 
    opacity: 0, 
    height: 0,
    transition: { duration: durations.normal },
  },
  visible: { 
    opacity: 1, 
    height: 'auto',
    transition: { duration: durations.normal },
  },
};

/**
 * Page transition variants
 */
export const pageTransitionVariants: Variants = {
  initial: { 
    opacity: 0,
    y: 8,
  },
  animate: { 
    opacity: 1,
    y: 0,
    transition: {
      duration: durations.normal,
      ease: easings.easeOut,
    },
  },
  exit: { 
    opacity: 0,
    y: -8,
    transition: {
      duration: durations.fast,
    },
  },
};

/**
 * Creates a stagger transition with custom delay
 */
export function createStaggerTransition(staggerDelay = 0.05): Transition {
  return {
    staggerChildren: staggerDelay,
    delayChildren: 0.1,
  };
}

/**
 * Creates a custom spring transition
 */
export function createSpringTransition(
  damping = 25,
  stiffness = 300
): Transition {
  return {
    type: 'spring',
    damping,
    stiffness,
  };
}
