'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ListTodo,
  Inbox,
  Tag,
  ChevronRight,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { List, Label } from '@/types';

/**
 * Sidebar animation variants for Framer Motion
 * Requirements: 21.1
 */
const sidebarVariants: Variants = {
  expanded: { 
    width: 256,
    transition: { 
      duration: 0.2, 
      ease: [0.4, 0, 0.2, 1],
      when: 'beforeChildren',
    },
  },
  collapsed: { 
    width: 64,
    transition: { 
      duration: 0.2, 
      ease: [0.4, 0, 0.2, 1],
      when: 'afterChildren',
    },
  },
};

const contentVariants: Variants = {
  expanded: { 
    opacity: 1,
    transition: { duration: 0.15, delay: 0.05 },
  },
  collapsed: { 
    opacity: 0,
    transition: { duration: 0.1 },
  },
};

const navItemVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.03,
      duration: 0.2,
    },
  }),
};

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
  index?: number;
}

function NavItem({ href, icon, label, badge, isActive, collapsed, color, emoji, index = 0 }: NavItemProps) {
  return (
    <motion.div
      custom={index}
      variants={navItemVariants}
      initial="hidden"
      animate="visible"
    >
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
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.span
              key="label"
              variants={contentVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="flex-1 truncate"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
        {!collapsed && badge !== undefined && badge > 0 && (
          <motion.div
            variants={contentVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
          >
            <Badge variant="secondary" className="ml-auto h-5 min-w-5 px-1.5 text-xs">
              {badge}
            </Badge>
          </motion.div>
        )}
        {collapsed && badge !== undefined && badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </Link>
    </motion.div>
  );
}

function SectionHeader({ title, collapsed, onAdd }: { title: string; collapsed?: boolean; onAdd?: () => void }) {
  return (
    <AnimatePresence mode="wait">
      {!collapsed && (
        <motion.div
          key={title}
          variants={contentVariants}
          initial="collapsed"
          animate="expanded"
          exit="collapsed"
          className="flex items-center justify-between px-3 py-2"
        >
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Sidebar Component
 * Animated sidebar with collapsible navigation using Framer Motion.
 * 
 * Requirements: 18.1, 18.2, 18.3, 18.4, 21.1
 */
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
      variants={sidebarVariants}
      animate={collapsed ? 'collapsed' : 'expanded'}
      className={cn(
        'flex h-full flex-col border-r bg-sidebar text-sidebar-foreground',
        'relative overflow-hidden'
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex h-14 items-center border-b px-4',
        collapsed && 'justify-center px-2'
      )}>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.h1
              key="title"
              variants={contentVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="text-lg font-semibold"
            >
              Tasks
            </motion.h1>
          )}
        </AnimatePresence>
        {onToggleCollapse && (
          <motion.div
            animate={{ marginLeft: collapsed ? 0 : 'auto' }}
            transition={{ duration: 0.2 }}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleCollapse}
            >
              <motion.div
                animate={{ rotate: collapsed ? 0 : 180 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="h-4 w-4" />
              </motion.div>
            </Button>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {/* Views Section */}
        <div className="space-y-1">
          <SectionHeader title="Views" collapsed={collapsed} />
          {views.map((view, index) => (
            <NavItem
              key={view.href}
              href={view.href}
              icon={view.icon}
              label={view.label}
              isActive={pathname === view.href}
              collapsed={collapsed}
              index={index}
            />
          ))}
        </div>

        {/* Overdue indicator */}
        <AnimatePresence>
          {overdueCount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 space-y-1"
            >
              <NavItem
                href="/overdue"
                icon={<AlertCircle className="h-4 w-4 text-destructive" />}
                label="Overdue"
                badge={overdueCount}
                isActive={pathname === '/overdue'}
                collapsed={collapsed}
                index={0}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lists Section */}
        <div className="mt-6 space-y-1">
          <SectionHeader title="Lists" collapsed={collapsed} onAdd={onCreateList} />
          {lists.map((list, index) => (
            <NavItem
              key={list.id}
              href={`/list/${list.id}`}
              icon={list.isInbox ? <Inbox className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
              label={list.name}
              isActive={pathname === `/list/${list.id}`}
              collapsed={collapsed}
              color={list.color}
              emoji={list.emoji}
              index={index}
            />
          ))}
        </div>

        {/* Labels Section */}
        <AnimatePresence>
          {labels.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-6 space-y-1"
            >
              <SectionHeader title="Labels" collapsed={collapsed} onAdd={onCreateLabel} />
              {labels.map((label, index) => (
                <NavItem
                  key={label.id}
                  href={`/label/${label.id}`}
                  icon={label.icon ? <span>{label.icon}</span> : <Tag className="h-4 w-4" />}
                  label={label.name}
                  isActive={pathname === `/label/${label.id}`}
                  collapsed={collapsed}
                  index={index}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </motion.aside>
  );
}

export default Sidebar;
