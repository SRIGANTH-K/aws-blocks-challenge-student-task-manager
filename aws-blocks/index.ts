/**
 * Backend — aws-blocks/index.ts
 *
 * Student Task Manager
 * Uses AuthBasic for auth, KVStore for storage, and ApiNamespace for the API.
 *
 * KVStore key design (user-scoped):
 *   In taskStore:  tasks:<userId>:<taskId>  →  Task object
 *   In indexStore: task-index:<userId>      →  comma-separated taskId list
 *
 * Each user's data is isolated by scoping keys with their userId.
 * requireAuth() on every API method ensures the userId always matches
 * the authenticated session — no cross-user data leaks.
 */
import { ApiNamespace, Scope, AuthBasic, KVStore } from '@aws-blocks/blocks';

const scope = new Scope('my-app');

// ─── Auth ────────────────────────────────────────────────────────────────────
const auth = new AuthBasic(scope, 'auth', {
  passwordPolicy: { minLength: 8 },
  crossDomain: process.env.BLOCKS_SANDBOX === 'true',
});
export const authApi = auth.createApi();

// ─── Data ────────────────────────────────────────────────────────────────────
// Task shape. This type is exported so the frontend can import it for typing.
export type Task = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  userId: string;
};

// Typed KVStore for Task objects. KVStore<Task> stores Task values as JSON.
const taskStore = new KVStore<Task>(scope, 'todos', {});

// Typed KVStore for the per-user index.
// We store the list as a JSON-serialised string[] (array of task IDs).
// KVStore<string[]> handles serialization automatically.
const indexStore = new KVStore<string[]>(scope, 'todos-index', {});

// Helper: key for a single task
const taskKey = (userId: string, taskId: string) => `tasks:${userId}:${taskId}`;

// Helper: key for the ordered list of task IDs belonging to a user
const indexKey = (userId: string) => `task-index:${userId}`;

// ─── API ─────────────────────────────────────────────────────────────────────
export const api = new ApiNamespace(scope, 'api', (context) => ({

  /** Return all tasks for the signed-in user, ordered by creation time. */
  async listTasks(): Promise<Task[]> {
    const user = await auth.requireAuth(context);
    const ids = (await indexStore.get(indexKey(user.username))) ?? [];
    const tasks: Task[] = [];
    for (const id of ids) {
      const task = await taskStore.get(taskKey(user.username, id));
      if (task) tasks.push(task);
    }
    return tasks;
  },

  /** Create a new task for the signed-in user. */
  async createTask(title: string): Promise<Task> {
    const user = await auth.requireAuth(context);
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const task: Task = {
      id,
      title: title.trim(),
      completed: false,
      createdAt: Date.now(),
      userId: user.username,
    };
    // Save the task object
    await taskStore.put(taskKey(user.username, id), task);
    // Append the task ID to the user's ordered index
    const ids = (await indexStore.get(indexKey(user.username))) ?? [];
    await indexStore.put(indexKey(user.username), [...ids, id]);
    return task;
  },

  /** Update the title of an existing task. */
  async updateTask(taskId: string, title: string): Promise<Task> {
    const user = await auth.requireAuth(context);
    const key = taskKey(user.username, taskId);
    const task = await taskStore.get(key);
    if (!task) throw new Error('Task not found');
    // Extra guard: userId in the stored object must match the authenticated user
    if (task.userId !== user.username) throw new Error('Forbidden');
    const updated: Task = { ...task, title: title.trim() };
    await taskStore.put(key, updated);
    return updated;
  },

  /** Toggle the completed status of a task. */
  async toggleTask(taskId: string): Promise<Task> {
    const user = await auth.requireAuth(context);
    const key = taskKey(user.username, taskId);
    const task = await taskStore.get(key);
    if (!task) throw new Error('Task not found');
    if (task.userId !== user.username) throw new Error('Forbidden');
    const updated: Task = { ...task, completed: !task.completed };
    await taskStore.put(key, updated);
    return updated;
  },

  /** Delete a task. */
  async deleteTask(taskId: string): Promise<{ success: boolean }> {
    const user = await auth.requireAuth(context);
    const key = taskKey(user.username, taskId);
    const task = await taskStore.get(key);
    if (!task) throw new Error('Task not found');
    if (task.userId !== user.username) throw new Error('Forbidden');
    // Delete the task object
    await taskStore.delete(key);
    // Remove from the user's index
    const ids = (await indexStore.get(indexKey(user.username))) ?? [];
    await indexStore.put(indexKey(user.username), ids.filter((i) => i !== taskId));
    return { success: true };
  },
}));
