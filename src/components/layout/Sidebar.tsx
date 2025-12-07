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
    width: 300,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
  },
  collapsed: { 
    width: 80,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
  },
};

const contentVariants: Variants = {
  expanded: { opacity: 1, x: 0, transition: { duration: 0.25, delay: 0.1 } },
  collapsed: { opacity: 0, x: -10, transition: { duration: 0.2 } },
};

const navItemVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.4, ease: [0.4, 0, 0.2, 1] },
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
  emoji?: string;
  index?: number;
  isMobile?: boolean;
  gradient?: boolean;
}

function NavItem({ 
  href, icon, label, badge, isActive, collapsed, emoji, index = 0, isMobile = false, gradient = false,
}: NavItemProps): React.ReactElement {
  return (
    <motion.div custom={index} variants={navItemVariants} initial="hidden" animate="visible">
      <Link
        href={href}
        data-active={isActive}
        className={cn(
          'sidebar-nav-item group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium',
          'transition-all duration-300',
          collapsed && 'justify-center px-3',
          isMobile && 'py-4 min-h-[56px]',
          isActive && 'text-foreground',
          !isActive && 'text-muted-foreground hover:text-foreground'
        )}
      >
        {isActive && (
          <motion.div
            layoutId="activeNavBg"
            className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10"
            initial={false}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        
        <span className={cn(
          'relative z-10 shrink-0 transition-all duration-300',
          'group-hover:scale-110',
          gradient && isActive && 'text-primary',
          isMobile && 'text-lg'
        )}>
          {emoji ? <span className={cn('text-xl', isMobile && 'text-2xl')}>{emoji}</span> : icon}
        </span>
        
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.span
              key="label"
              variants={contentVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className={cn('relative z-10 flex-1 truncate', isMobile && 'text-base')}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
        
        {!collapsed && badge !== undefined && badge > 0 && (
          <motion.div variants={contentVariants} initial="collapsed" animate="expanded" exit="collapsed" className="relative z-10">
            <Badge variant="secondary" className="ml-auto h-6 min-w-6 px-2 text-xs font-semibold bg-primary/15 text-primary border-0 rounded-full">
              {badge}
            </Badge>
          </motion.div>
        )}
        
        {collapsed && badge !== undefined && badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-lg">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </Link>
    </motion.div>
  );
}


function SectionHeader({ title, collapsed, onAdd }: { title: string; collapsed?: boolean; onAdd?: () => void }): React.ReactElement | null {
  return (
    <AnimatePresence mode="wait">
      {!collapsed && (
        <motion.div
          key={title}
          variants={contentVariants}
          initial="collapsed"
          animate="expanded"
          exit="collapsed"
          className="flex items-center justify-between px-4 py-3 mt-4"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
            {title}
          </span>
          {onAdd && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-xl hover:bg-primary/10 hover:text-primary transition-all duration-300 hover:scale-110"
              onClick={onAdd}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Sidebar({
  lists, labels, overdueCount, collapsed = false, onToggleCollapse, onCreateList, onCreateLabel, isMobile = false,
}: SidebarProps): React.ReactElement {
  const pathname = usePathname();

  const views = [
    { href: '/today', icon: <Calendar className="h-5 w-5" />, label: 'Today', gradient: true },
    { href: '/next-7-days', icon: <CalendarDays className="h-5 w-5" />, label: 'Next 7 Days' },
    { href: '/upcoming', icon: <CalendarRange className="h-5 w-5" />, label: 'Upcoming' },
    { href: '/all', icon: <ListTodo className="h-5 w-5" />, label: 'All Tasks' },
  ];

  const isCollapsed = isMobile ? false : collapsed;

  return (
    <motion.aside
      initial={false}
      variants={sidebarVariants}
      animate={isCollapsed ? 'collapsed' : 'expanded'}
      className={cn(
        'flex h-full flex-col',
        'aurora-glass border-r border-border/20',
        'relative overflow-hidden',
        isMobile && 'w-80 shadow-2xl rounded-r-3xl'
      )}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      {/* Header */}
      <div className={cn(
        'relative flex h-20 items-center border-b border-border/20 px-5',
        isCollapsed && 'justify-center px-3'
      )}>
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              key="title"
              variants={contentVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="flex items-center gap-3"
            >
              <motion.div 
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-accent shadow-lg shadow-primary/30"
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
              >
                <Sparkles className="h-5 w-5 text-white" />
              </motion.div>
              <span className="text-xl font-bold gradient-text-aurora">Tasks</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        {onToggleCollapse && (
          <motion.div animate={{ marginLeft: isCollapsed ? 0 : 'auto' }} transition={{ duration: 0.3 }}>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-10 w-10 rounded-2xl hover:bg-primary/10 transition-all duration-300', isMobile && 'h-11 w-11')}
              onClick={onToggleCollapse}
            >
              <motion.div animate={{ rotate: isMobile ? 180 : (isCollapsed ? 0 : 180) }} transition={{ duration: 0.4 }}>
                {isMobile ? <X className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </motion.div>
            </Button>
          </motion.div>
        )}
      </div>

 
     {/* Navigation */}
      <nav className={cn('relative flex-1 overflow-y-auto p-3 space-y-1', isMobile && 'overscroll-contain')}>
        <div className="space-y-1">
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

        <AnimatePresence>
          {overdueCount > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-1">
              <NavItem
                href="/overdue"
                icon={<AlertCircle className="h-5 w-5 text-destructive" />}
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

        <div className="pt-2 space-y-1">
          <SectionHeader title="Lists" collapsed={isCollapsed} onAdd={onCreateList} />
          {lists.map((list, index) => (
            <NavItem
              key={list.id}
              href={`/list/${list.id}`}
              icon={list.isInbox ? <Inbox className="h-5 w-5" /> : <ListTodo className="h-5 w-5" />}
              label={list.name}
              isActive={pathname === `/list/${list.id}`}
              collapsed={isCollapsed}
              emoji={list.emoji}
              index={index}
              isMobile={isMobile}
            />
          ))}
        </div>

        <div className="pt-2 space-y-1">
          <SectionHeader title="Labels" collapsed={isCollapsed} onAdd={onCreateLabel} />
          {labels.map((label, index) => (
            <NavItem
              key={label.id}
              href={`/label/${label.id}`}
              icon={label.icon ? <span>{label.icon}</span> : <Tag className="h-5 w-5" />}
              label={label.name}
              isActive={pathname === `/label/${label.id}`}
              collapsed={isCollapsed}
              index={index}
              isMobile={isMobile}
            />
          ))}
        </div>
      </nav>
      
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-sidebar via-sidebar/80 to-transparent pointer-events-none" />
    </motion.aside>
  );
}

export default Sidebar;