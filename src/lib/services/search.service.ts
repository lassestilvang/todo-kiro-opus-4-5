import Fuse from 'fuse.js';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import type { Task, Label, ISearchService } from '@/types';

/**
 * Search result with relevance score
 */
export interface SearchResult {
  task: Task;
  score: number;
}

/**
 * Internal type for searchable task data
 */
interface SearchableTask {
  id: string;
  name: string;
  description: string;
  labelNames: string;
  task: Task;
}

/**
 * Converts a database row to a Task entity
 */
function toTask(row: typeof schema.tasks.$inferSelect): Task {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    listId: row.listId,
    date: row.date ?? undefined,
    deadline: row.deadline ?? undefined,
    estimate: row.estimate ?? undefined,
    actualTime: row.actualTime ?? undefined,
    priority: row.priority as Task['priority'],
    completed: row.completed,
    completedAt: row.completedAt ?? undefined,
    recurrence: row.recurrence as Task['recurrence'],
    parentTaskId: row.parentTaskId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Converts a database row to a Label entity
 */
function toLabel(row: typeof schema.labels.$inferSelect): Label {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}


/**
 * Fetches labels for a task
 */
async function getLabelsForTask(taskId: string): Promise<Label[]> {
  const rows = await db
    .select({
      label: schema.labels,
    })
    .from(schema.taskLabels)
    .innerJoin(schema.labels, eq(schema.taskLabels.labelId, schema.labels.id))
    .where(eq(schema.taskLabels.taskId, taskId));

  return rows.map(r => toLabel(r.label));
}

/**
 * Fuse.js configuration for fuzzy search
 * - Searches across name, description, and label names
 * - Uses extended search for better matching
 * - Returns results ranked by relevance score
 */
const FUSE_OPTIONS = {
  keys: [
    { name: 'name', weight: 0.5 },
    { name: 'description', weight: 0.3 },
    { name: 'labelNames', weight: 0.2 },
  ],
  threshold: 0.4,           // Lower = more strict matching
  includeScore: true,       // Include relevance score in results
  ignoreLocation: true,     // Search entire string, not just beginning
  minMatchCharLength: 1,    // Minimum characters to match
  shouldSort: true,         // Sort by score
  findAllMatches: true,     // Find all matches in the string
};

/**
 * Search Service Implementation
 * Provides fuzzy search across tasks using Fuse.js
 */
export const searchService: ISearchService = {
  /**
   * Searches for tasks matching the query using fuzzy matching.
   * Searches across task names, descriptions, and label names.
   * Returns results ranked by relevance score (higher scores first).
   * 
   * @param query - The search query string
   * @returns Tasks matching the query, ranked by relevance
   * 
   * Requirements: 17.1, 17.2, 17.3, 17.4
   */
  async search(query: string): Promise<Task[]> {
    // Return empty array for empty query (Requirement 17.4)
    if (!query || query.trim() === '') {
      return [];
    }

    // Fetch all tasks from database
    const taskRows = await db.select().from(schema.tasks);

    // Build searchable data with labels
    const searchableData: SearchableTask[] = [];
    
    for (const row of taskRows) {
      const task = toTask(row);
      const labels = await getLabelsForTask(row.id);
      task.labels = labels;
      
      searchableData.push({
        id: row.id,
        name: row.name,
        description: row.description ?? '',
        labelNames: labels.map(l => l.name).join(' '),
        task,
      });
    }

    // Create Fuse instance and search
    const fuse = new Fuse(searchableData, FUSE_OPTIONS);
    const results = fuse.search(query.trim());

    // Return tasks ranked by relevance (Fuse already sorts by score)
    // Lower score = better match in Fuse.js
    return results.map(result => result.item.task);
  },
};

export default searchService;
