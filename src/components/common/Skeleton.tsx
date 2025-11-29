'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base Skeleton component for loading states
 * Requirements: 25.1
 */
export function Skeleton({ className, ...props }: SkeletonProps): React.ReactElement {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

/**
 * Task Item Skeleton - mimics the TaskItem component structure
 * Requirements: 25.1
 */
export function TaskItemSkeleton(): React.ReactElement {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      {/* Checkbox skeleton */}
      <Skeleton className="h-5 w-5 rounded-full shrink-0 mt-0.5" />
      
      <div className="flex-1 space-y-2">
        {/* Task name */}
        <Skeleton className="h-4 w-3/4" />
        
        {/* Task metadata row */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      
      {/* Priority indicator */}
      <Skeleton className="h-4 w-4 rounded-full shrink-0" />
    </div>
  );
}

/**
 * Task List Skeleton - shows multiple task item skeletons
 * Requirements: 25.1
 */
export function TaskListSkeleton({ count = 5 }: { count?: number }): React.ReactElement {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <TaskItemSkeleton key={i} />
      ))}
    </div>
  );
}


/**
 * Sidebar Skeleton - mimics the Sidebar component structure
 * Requirements: 25.1
 */
export function SidebarSkeleton({ collapsed = false }: { collapsed?: boolean }): React.ReactElement {
  if (collapsed) {
    return (
      <div className="flex h-full w-16 flex-col border-r bg-sidebar p-2">
        {/* Header */}
        <div className="flex h-14 items-center justify-center border-b">
          <Skeleton className="h-8 w-8 rounded" />
        </div>
        
        {/* Nav items */}
        <div className="flex-1 space-y-2 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-8 mx-auto rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar p-2">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
      
      {/* Views Section */}
      <div className="space-y-1 py-4">
        <div className="px-3 py-2">
          <Skeleton className="h-3 w-12" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      
      {/* Lists Section */}
      <div className="space-y-1 py-4">
        <div className="px-3 py-2">
          <Skeleton className="h-3 w-10" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      
      {/* Labels Section */}
      <div className="space-y-1 py-4">
        <div className="px-3 py-2">
          <Skeleton className="h-3 w-12" />
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Page Header Skeleton
 * Requirements: 25.1
 */
export function PageHeaderSkeleton(): React.ReactElement {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-9 w-24 rounded-md" />
    </div>
  );
}

/**
 * Task Detail Skeleton - for the task detail dialog
 * Requirements: 25.1
 */
export function TaskDetailSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      
      {/* Description */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-20 w-full" />
      </div>
      
      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
      
      {/* Subtasks */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
