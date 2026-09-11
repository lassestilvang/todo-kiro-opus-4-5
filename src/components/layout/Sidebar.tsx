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
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { List, Label } from '@/types';

const sidebarVariants: Variants = {
  expanded: { 
    width: 280,
    transition: { 
      duration: 0.3, 
      ease: [0.4, 0, 0.2, 1],
      when: 'beforeChildren',
    },
  },
  collapsed: { 
    width: 72,
    transition: { 
      duration: 0.3, 
      ease: [0.4, 0, 0.2, 1],
      when: 'afterChildren',
    },
  },
};

const contentVariants: Variants = {
  expanded: { 
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, delay: 0.1 },
  },
  collapsed: { 
    opacity: 0,
    x: -10,
    transition: { duration: 0.15 },
  },
};

const navItemVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
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
  isMobile?: boolean;
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
  isMobile?: boolean;
  gradient?: boolean;
}

function NavItem({ 
  href, 
  icon, 
  label, 
  badge, 
  isActive, 
  collapsed, 
  emoji, 
  index = 0, 
  isMobile = false,
  gradient = false,
}: NavItemProps): React.ReactElement {
  return (
    <motion.div
      custom={index}
      variants={navItemVariants}
      initial="hidden"
      animate="visible"
    >
      <Link
        href={href}
        data-active={isActive}
        className={cn(
          'sidebar-nav-item group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
          'transition-all duration-200',
          collapsed && 'justify-center px-2',
          isMobile && 'py-3.5 min-h-[52px]',
          isActive && 'text-foreground',
          !isActive && 'text-muted-foreground hover:text-foreground'
        )}
      >
        {/* Active indicator glow */}
        {isActive && (
          <motion.div
            layoutId="activeGlow"
            className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10"
            initial={false}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
        
        {/* Icon */}
        <span className={cn(
          'relative z-10 shrink-0 transition-transform duration-200',
          'group-hover:scale-110',
          gradient && 'gradient-text',
          isMobile && 'text-lg'
        )}>
          {emoji ? (
            <span className={cn('text-lg', isMobile && 'text-xl')}>{emoji}</span>
          ) : (
            icon
          )}
        </span>
        
        {/* Label */}
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.span
              key="label"
              variants={contentVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className={cn(
                'relative z-10 flex-1 truncate',
                isMobile && 'text-base'
              )}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
        
        {/* Badge */}
        {!collapsed && badge !== undefined && badge > 0 && (
          <motion.div
            variants={contentVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="relative z-10"
          >
            <Badge 
              variant="secondary" 
              className={cn(
                'ml-auto h-5 min-w-5 px-1.5 text-xs font-semibold',
                'bg-primary/10 text-primary border-0'
              )}
            >
              {badge}
            </Badge>
          </motion.div>
        )}
        
        {/* Collapsed badge */}
        {collapsed && badge !== undefined && badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-lg">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </Link>
    </motion.div>
  );
}

function SectionHeader({ 
  title, 
  collapsed, 
  onAdd 
}: { 
  title: string; 
  collapsed?: boolean; 
  onAdd?: () => void;
}): React.ReactElement | null {
  return (
    <AnimatePresence mode="wait">
      {!collapsed && (
        <motion.div
          key={title}
          variants={contentVariants}
          initial="collapsed"
          animate="expanded"
          exit="collapsed"
          className="flex items-center justify-between px-3 py-2 mt-2"
        >
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            {title}
          </span>
          {onAdd && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={onAdd}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
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
  isMobile = false,
}: SidebarProps): React.ReactElement {
  const pathname = usePathname();

  const views = [
    { href: '/today', icon: <Calendar className="h-[18px] w-[18px]" />, label: 'Today', gradient: true },
    { href: '/next-7-days', icon: <CalendarDays className="h-[18px] w-[18px]" />, label: 'Next 7 Days' },
    { href: '/upcoming', icon: <CalendarRange className="h-[18px] w-[18px]" />, label: 'Upcoming' },
    { href: '/all', icon: <ListTodo className="h-[18px] w-[18px]" />, label: 'All Tasks' },
  ];

  const isCollapsed = isMobile ? false : collapsed;

  return (
    <motion.aside
      initial={false}
      variants={sidebarVariants}
      animate={isCollapsed ? 'collapsed' : 'expanded'}
      className={cn(
        'flex h-full flex-col',
        'glass-card border-r-0 rounded-none',
        'relative overflow-hidden',
        isMobile && 'w-72 shadow-2xl rounded-r-3xl'
      )}
    >
      {/* Ambient gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      {/* Header */}
      <div className={cn(
        'relative flex h-16 items-center border-b border-border/50 px-4',
        isCollapsed && 'justify-center px-2'
      )}>
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              key="title"
              variants={contentVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="flex items-center gap-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold gradient-text">Tasks</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        {onToggleCollapse && (
          <motion.div
            animate={{ marginLeft: isCollapsed ? 0 : 'auto' }}
            transition={{ duration: 0.2 }}
          >
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-xl hover:bg-primary/10 transition-colors',
                isMobile && 'h-10 w-10'
              )}
              onClick={onToggleCollapse}
            >
              <motion.div
                animate={{ rotate: isMobile ? 180 : (isCollapsed ? 0 : 180) }}
                transition={{ duration: 0.3 }}
              >
                {isMobile ? (
                  <X className="h-5 w-5" />
                ) : (
                  <ChevronRight className={cn('h-4 w-4', isMobile && 'h-5 w-5')} />
                )}
              </motion.div>
            </Button>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn(
        'relative flex-1 overflow-y-auto p-3 space-y-1',
        isMobile && 'overscroll-contain'
      )}>
        {/* Views Section */}
        <div className="space-y-0.5">
          <SectionHeader title="Views" collapsed={isCollapsed} />
          {views.map((view, index) => (
            <NavItem
              key={view.href}
              href={view.href}
              icon={view.icon}
              label={view.label}
              isActive={pathname === view.href}
              collapsed={isCollapsed}
              index={index}
              isMobile={isMobile}
              gradient={view.gradient}
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
              className="pt-1"
            >
              <NavItem
                href="/overdue"
                icon={<AlertCircle className="h-[18px] w-[18px] text-destructive" />}
                label="Overdue"
                badge={overdueCount}
                isActive={pathname === '/overdue'}
                collapsed={isCollapsed}
                index={0}
                isMobile={isMobile}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lists Section */}
        <div className="pt-4 space-y-0.5">
          <SectionHeader title="Lists" collapsed={isCollapsed} onAdd={onCreateList} />
          {lists.map((list, index) => (
            <NavItem
              key={list.id}
              href={`/list/${list.id}`}
              icon={list.isInbox ? <Inbox className="h-[18px] w-[18px]" /> : <ListTodo className="h-[18px] w-[18px]" />}
              label={list.name}
              isActive={pathname === `/list/${list.id}`}
              collapsed={isCollapsed}
              emoji={list.emoji}
              index={index}
              isMobile={isMobile}
            />
          ))}
        </div>

        {/* Labels Section */}
        <div className="pt-4 space-y-0.5">
          <SectionHeader title="Labels" collapsed={isCollapsed} onAdd={onCreateLabel} />
          {labels.map((label, index) => (
            <NavItem
              key={label.id}
              href={`/label/${label.id}`}
              icon={label.icon ? <span>{label.icon}</span> : <Tag className="h-[18px] w-[18px]" />}
              label={label.name}
              isActive={pathname === `/label/${label.id}`}
              collapsed={isCollapsed}
              index={index}
              isMobile={isMobile}
            />
          ))}
        </div>
      </nav>
      
      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-sidebar to-transparent pointer-events-none" />
    </motion.aside>
  );
}

export default Sidebar;
