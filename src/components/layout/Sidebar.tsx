'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ListTodo,
  Inbox,
  Tag,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { List, Label } from '@/types';

interface SidebarProps {
  lists: List[];
  labels: Label[];
  overdueCount: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onCreateList?: () => void;
  onCreateLabel?: () => void;
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  isActive: boolean;
  collapsed?: boolean;
  color?: string;
  emoji?: string;
}

function NavItem({ href, icon, label, badge, isActive, collapsed, color, emoji }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isActive && 'bg-accent text-accent-foreground font-medium',
        collapsed && 'justify-center px-2'
      )}
    >
      {emoji ? (
        <span className="text-base">{emoji}</span>
      ) : (
        <span className={cn('shrink-0', color && `text-[${color}]`)}>{icon}</span>
      )}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {badge !== undefined && badge > 0 && (
            <Badge variant="secondary" className="ml-auto h-5 min-w-5 px-1.5 text-xs">
              {badge}
            </Badge>
          )}
        </>
      )}
      {collapsed && badge !== undefined && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}

function SectionHeader({ title, collapsed, onAdd }: { title: string; collapsed?: boolean; onAdd?: () => void }) {
  if (collapsed) return null;
  
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
      {onAdd && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onAdd}
        >
          <Plus className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export function Sidebar({
  lists,
  labels,
  overdueCount,
  collapsed = false,
  onToggleCollapse,
  onCreateList,
  onCreateLabel,
}: SidebarProps) {
  const pathname = usePathname();

  const views = [
    { href: '/today', icon: <Calendar className="h-4 w-4" />, label: 'Today' },
    { href: '/next-7-days', icon: <CalendarDays className="h-4 w-4" />, label: 'Next 7 Days' },
    { href: '/upcoming', icon: <CalendarRange className="h-4 w-4" />, label: 'Upcoming' },
    { href: '/all', icon: <ListTodo className="h-4 w-4" />, label: 'All' },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        'flex h-full flex-col border-r bg-sidebar text-sidebar-foreground',
        'relative'
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex h-14 items-center border-b px-4',
        collapsed && 'justify-center px-2'
      )}>
        {!collapsed && (
          <h1 className="text-lg font-semibold">Tasks</h1>
        )}
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8', !collapsed && 'ml-auto')}
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {/* Views Section */}
        <div className="space-y-1">
          <SectionHeader title="Views" collapsed={collapsed} />
          {views.map((view) => (
            <NavItem
              key={view.href}
              href={view.href}
              icon={view.icon}
              label={view.label}
              isActive={pathname === view.href}
              collapsed={collapsed}
            />
          ))}
        </div>

        {/* Overdue indicator */}
        {overdueCount > 0 && (
          <div className="mt-2 space-y-1">
            <NavItem
              href="/overdue"
              icon={<AlertCircle className="h-4 w-4 text-destructive" />}
              label="Overdue"
              badge={overdueCount}
              isActive={pathname === '/overdue'}
              collapsed={collapsed}
            />
          </div>
        )}

        {/* Lists Section */}
        <div className="mt-6 space-y-1">
          <SectionHeader title="Lists" collapsed={collapsed} onAdd={onCreateList} />
          {lists.map((list) => (
            <NavItem
              key={list.id}
              href={`/list/${list.id}`}
              icon={list.isInbox ? <Inbox className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
              label={list.name}
              isActive={pathname === `/list/${list.id}`}
              collapsed={collapsed}
              color={list.color}
              emoji={list.emoji}
            />
          ))}
        </div>

        {/* Labels Section */}
        {labels.length > 0 && (
          <div className="mt-6 space-y-1">
            <SectionHeader title="Labels" collapsed={collapsed} onAdd={onCreateLabel} />
            {labels.map((label) => (
              <NavItem
                key={label.id}
                href={`/label/${label.id}`}
                icon={label.icon ? <span>{label.icon}</span> : <Tag className="h-4 w-4" />}
                label={label.name}
                isActive={pathname === `/label/${label.id}`}
                collapsed={collapsed}
              />
            ))}
          </div>
        )}
      </nav>
    </motion.aside>
  );
}

export default Sidebar;
