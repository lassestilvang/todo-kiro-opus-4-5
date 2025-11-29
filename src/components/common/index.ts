// Common Components
// Reusable UI components for the Daily Task Planner

export { DatePicker } from './DatePicker';
export type { DatePickerProps } from './DatePicker';

export { PrioritySelector, PriorityBadge, getPriorityOption } from './PrioritySelector';
export type { PrioritySelectorProps, PriorityBadgeProps } from './PrioritySelector';

export { RecurrenceSelector } from './RecurrenceSelector';
export type { RecurrenceSelectorProps } from './RecurrenceSelector';

export { SearchBar } from './SearchBar';
export type { SearchBarProps } from './SearchBar';

export { EmojiPicker } from './EmojiPicker';
export type { EmojiPickerProps } from './EmojiPicker';

export { ColorPicker, ColorDot } from './ColorPicker';
export type { ColorPickerProps, ColorDotProps } from './ColorPicker';

export {
  Skeleton,
  TaskItemSkeleton,
  TaskListSkeleton,
  SidebarSkeleton,
  PageHeaderSkeleton,
  TaskDetailSkeleton,
} from './Skeleton';

export { ErrorBoundary, ErrorFallback, QueryErrorFallback } from './ErrorBoundary';

export {
  AnimatedDialog,
  AnimatedDialogTrigger,
  AnimatedDialogContent,
  AnimatedDialogHeader,
  AnimatedDialogFooter,
  AnimatedDialogTitle,
  AnimatedDialogDescription,
  AnimatedDialogClose,
} from './AnimatedDialog';

export { PageTransition, FadeTransition, SlideTransition } from './PageTransition';
