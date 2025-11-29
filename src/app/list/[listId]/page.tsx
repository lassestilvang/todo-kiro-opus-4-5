'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Settings, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { TaskList, TaskDetail, TaskForm } from '@/components/tasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ColorPicker, EmojiPicker, TaskListSkeleton, QueryErrorFallback } from '@/components/common';
import { showSuccess, showError } from '@/lib/utils/toast';
import type { Task, List, Label, TaskHistoryEntry, CreateTaskInput, UpdateTaskInput, UpdateListInput } from '@/types';

/**
 * Parses dates from JSON response
 */
function parseTaskDates(task: Task): Task {
  return {
    ...task,
    date: task.date ? new Date(task.date) : undefined,
    deadline: task.deadline ? new Date(task.deadline) : undefined,
    completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt),
    subtasks: task.subtasks?.map(s => ({
      ...s,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
    })),
    labels: task.labels?.map(l => ({
      ...l,
      createdAt: new Date(l.createdAt),
      updatedAt: new Date(l.updatedAt),
    })),
  };
}

/**
 * Fetches a list by ID
 */
async function fetchList(listId: string): Promise<List> {
  const res = await fetch(`/api/lists/${listId}`);
  if (!res.ok) throw new Error('Failed to fetch list');
  return res.json();
}

/**
 * Fetches tasks for a specific list
 */
async function fetchListTasks(listId: string, includeCompleted: boolean): Promise<Task[]> {
  const res = await fetch(`/api/tasks?listId=${listId}&includeCompleted=${includeCompleted}`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  const data = await res.json();
  return data.map(parseTaskDates);
}

/**
 * Fetches all lists
 */
async function fetchLists(): Promise<List[]> {
  const res = await fetch('/api/lists');
  if (!res.ok) throw new Error('Failed to fetch lists');
  return res.json();
}

/**
 * Fetches all labels
 */
async function fetchLabels(): Promise<Label[]> {
  const res = await fetch('/api/labels');
  if (!res.ok) throw new Error('Failed to fetch labels');
  return res.json();
}

/**
 * Fetches task history
 */
async function fetchTaskHistory(taskId: string): Promise<TaskHistoryEntry[]> {
  const res = await fetch(`/api/tasks/${taskId}/history`);
  if (!res.ok) throw new Error('Failed to fetch task history');
  const data = await res.json();
  return data.map((entry: TaskHistoryEntry) => ({
    ...entry,
    changedAt: new Date(entry.changedAt),
  }));
}

/**
 * Updates a list
 */
async function updateList({ id, data }: { id: string; data: UpdateListInput }): Promise<List> {
  const res = await fetch(`/api/lists/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update list');
  return res.json();
}

/**
 * Deletes a list
 */
async function deleteList(listId: string): Promise<void> {
  const res = await fetch(`/api/lists/${listId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete list');
}

/**
 * Toggles task completion status
 */
async function toggleTaskComplete(taskId: string): Promise<Task> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: undefined }),
  });
  if (!res.ok) throw new Error('Failed to toggle task');
  return res.json();
}

/**
 * Creates a new task
 */
async function createTask(data: CreateTaskInput): Promise<Task> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create task');
  return res.json();
}

/**
 * Updates an existing task
 */
async function updateTask({ id, data }: { id: string; data: UpdateTaskInput }): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update task');
  return res.json();
}

/**
 * Deletes a task
 */
async function deleteTaskApi(taskId: string): Promise<void> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete task');
}

/**
 * List Detail Page Component
 * Displays tasks for a specific list with list management options.
 * 
 * Requirements: 2.2, 2.3
 */
export default function ListDetailPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const listId = params.listId as string;

  const [showCompleted, setShowCompleted] = React.useState(true);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isEditListOpen, setIsEditListOpen] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);

  // Edit list form state
  const [editName, setEditName] = React.useState('');
  const [editColor, setEditColor] = React.useState<string | undefined>();
  const [editEmoji, setEditEmoji] = React.useState<string | undefined>();

  // Fetch list details
  const { data: list, isLoading: isLoadingList, error: listError } = useQuery({
    queryKey: ['list', listId],
    queryFn: () => fetchList(listId),
  });

  // Fetch tasks for this list
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['tasks', 'list', listId, showCompleted],
    queryFn: () => fetchListTasks(listId, showCompleted),
    enabled: !!list,
  });

  // Fetch all lists and labels for forms
  const { data: lists = [] } = useQuery({
    queryKey: ['lists'],
    queryFn: fetchLists,
  });

  const { data: labels = [] } = useQuery({
    queryKey: ['labels'],
    queryFn: fetchLabels,
  });

  // Fetch history for selected task
  const { data: taskHistory = [] } = useQuery({
    queryKey: ['taskHistory', selectedTask?.id],
    queryFn: () => selectedTask ? fetchTaskHistory(selectedTask.id) : Promise.resolve([]),
    enabled: !!selectedTask,
  });

  // Initialize edit form when list loads
  React.useEffect(() => {
    if (list) {
      setEditName(list.name);
      setEditColor(list.color);
      setEditEmoji(list.emoji);
    }
  }, [list]);

  // Update list mutation
  const updateListMutation = useMutation({
    mutationFn: updateList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
      setIsEditListOpen(false);
      showSuccess('List updated');
    },
    onError: () => {
      showError('Failed to update list');
    },
  });

  // Delete list mutation
  const deleteListMutation = useMutation({
    mutationFn: deleteList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      showSuccess('List deleted. Tasks moved to Inbox.');
      router.push('/today');
    },
    onError: () => {
      showError('Failed to delete list');
    },
  });

  // Toggle complete mutation
  const toggleCompleteMutation = useMutation({
    mutationFn: toggleTaskComplete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['overdueCount'] });
    },
    onError: () => {
      showError('Failed to update task');
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsFormOpen(false);
      showSuccess('Task created');
    },
    onError: () => {
      showError('Failed to create task');
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: updateTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTask(null);
      showSuccess('Task updated');
    },
    onError: () => {
      showError('Failed to update task');
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: deleteTaskApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['overdueCount'] });
      setSelectedTask(null);
      showSuccess('Task deleted');
    },
    onError: () => {
      showError('Failed to delete task');
    },
  });

  const handleToggleComplete = (taskId: string): void => {
    toggleCompleteMutation.mutate(taskId);
  };

  const handleTaskClick = (task: Task): void => {
    setSelectedTask(task);
  };

  const handleToggleShowCompleted = (): void => {
    setShowCompleted(!showCompleted);
  };

  const handleCreateTask = (data: CreateTaskInput | UpdateTaskInput): void => {
    const taskData: CreateTaskInput = {
      ...(data as CreateTaskInput),
      listId,
    };
    createTaskMutation.mutate(taskData);
  };

  const handleUpdateTask = (data: CreateTaskInput | UpdateTaskInput): void => {
    if (selectedTask) {
      updateTaskMutation.mutate({ id: selectedTask.id, data: data as UpdateTaskInput });
    }
  };

  const handleDeleteTask = (): void => {
    if (selectedTask) {
      deleteTaskMutation.mutate(selectedTask.id);
    }
  };

  const handleToggleSelectedTaskComplete = (): void => {
    if (selectedTask) {
      toggleCompleteMutation.mutate(selectedTask.id);
    }
  };

  const handleUpdateList = (): void => {
    if (!editName.trim()) {
      showError('List name is required');
      return;
    }
    updateListMutation.mutate({
      id: listId,
      data: {
        name: editName.trim(),
        color: editColor,
        emoji: editEmoji,
      },
    });
  };

  const handleDeleteList = (): void => {
    deleteListMutation.mutate(listId);
  };

  const handleRetry = (): void => {
    queryClient.invalidateQueries({ queryKey: ['list', listId] });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'list', listId] });
  };

  if (listError) {
    return (
      <AppLayout title="List">
        <QueryErrorFallback 
          message="List not found or failed to load."
          onRetry={handleRetry}
        />
      </AppLayout>
    );
  }

  const isLoading = isLoadingList || isLoadingTasks;
  const isInbox = list?.isInbox ?? false;

  return (
    <AppLayout title={list?.name ?? 'List'}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {list?.emoji && <span>{list.emoji}</span>}
              {list?.name ?? 'Loading...'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsFormOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
            {!isInbox && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-40 p-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setIsEditListOpen(true)}
                  >
                    Edit List
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete List
                  </Button>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Task List */}
        {isLoading ? (
          <TaskListSkeleton count={5} />
        ) : (
          <TaskList
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onToggleComplete={handleToggleComplete}
            showCompleted={showCompleted}
            onToggleShowCompleted={handleToggleShowCompleted}
            emptyMessage={`No tasks in ${list?.name ?? 'this list'}.`}
          />
        )}
      </div>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedTask && (
            <TaskDetail
              task={selectedTask}
              lists={lists}
              labels={labels}
              history={taskHistory}
              onUpdate={handleUpdateTask}
              onDelete={handleDeleteTask}
              onToggleComplete={handleToggleSelectedTaskComplete}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>
          <TaskForm
            lists={lists}
            labels={labels}
            defaultListId={listId}
            onSubmit={handleCreateTask}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit List Dialog */}
      <Dialog open={isEditListOpen} onOpenChange={setIsEditListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="List name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Emoji</label>
              <EmojiPicker
                value={editEmoji}
                onChange={setEditEmoji}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <ColorPicker
                value={editColor}
                onChange={setEditColor}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditListOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateList} disabled={updateListMutation.isPending}>
              {updateListMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete List</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{list?.name}&quot;? All tasks in this list will be moved to Inbox.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteList}
              disabled={deleteListMutation.isPending}
            >
              {deleteListMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
