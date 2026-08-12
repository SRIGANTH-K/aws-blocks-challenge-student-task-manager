import React, { useState, useEffect, useCallback } from 'react';
import { api } from 'aws-blocks';
import type { Task } from 'aws-blocks';
import './app.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppState = 'loading' | 'ready' | 'error';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

// ─── TaskItem ─────────────────────────────────────────────────────────────────

function TaskItem({ task, onToggle, onEdit, onDelete }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [busy, setBusy] = useState(false);

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === task.title) {
      setEditing(false);
      setEditValue(task.title);
      return;
    }
    setBusy(true);
    onEdit(task.id, trimmed);
  }

  function handleEditCancel() {
    setEditing(false);
    setEditValue(task.title);
  }

  return (
    <li className={`task-item${task.completed ? ' task-completed' : ''}`}>
      <input
        type="checkbox"
        className="task-checkbox"
        checked={task.completed}
        disabled={busy}
        onChange={() => {
          setBusy(true);
          onToggle(task.id);
        }}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
      />

      {editing ? (
        <form className="task-edit-form" onSubmit={handleEditSubmit}>
          <input
            className="task-edit-input"
            value={editValue}
            autoFocus
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && handleEditCancel()}
            aria-label="Edit task title"
          />
          <button type="submit" className="btn btn-save" disabled={busy}>
            Save
          </button>
          <button type="button" className="btn btn-cancel" onClick={handleEditCancel}>
            Cancel
          </button>
        </form>
      ) : (
        <span className="task-title">{task.title}</span>
      )}

      {!editing && (
        <div className="task-actions">
          <button
            className="btn btn-edit"
            onClick={() => setEditing(true)}
            disabled={busy}
            aria-label="Edit task"
          >
            Edit
          </button>
          <button
            className="btn btn-delete"
            onClick={() => {
              setBusy(true);
              onDelete(task.id);
            }}
            disabled={busy}
            aria-label="Delete task"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [state, setState] = useState<AppState>('loading');
  const [error, setError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  // Load tasks from the API
  const loadTasks = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const result = await api.listTasks();
      setTasks(result);
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks.');
      setState('error');
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Create a new task
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setCreating(true);
    setError('');
    try {
      const task = await api.createTask(trimmed);
      setTasks((prev) => [...prev, task]);
      setNewTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setCreating(false);
    }
  }

  // Toggle complete/incomplete
  async function handleToggle(id: string) {
    setError('');
    try {
      const updated = await api.toggleTask(id);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task.');
      await loadTasks(); // re-sync on error
    }
  }

  // Edit task title
  async function handleEdit(id: string, title: string) {
    setError('');
    try {
      const updated = await api.updateTask(id, title);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task.');
      await loadTasks();
    }
  }

  // Delete task
  async function handleDelete(id: string) {
    setError('');
    try {
      await api.deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task.');
      await loadTasks();
    }
  }

  const remaining = tasks.filter((t) => !t.completed).length;

  return (
    <div className="app-content">
      {/* ── New task form ── */}
      <form className="new-task-form" onSubmit={handleCreate}>
        <input
          className="new-task-input"
          type="text"
          placeholder="Add a new task…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          disabled={creating || state === 'loading'}
          aria-label="New task title"
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={creating || !newTitle.trim() || state === 'loading'}
        >
          {creating ? 'Adding…' : 'Add Task'}
        </button>
      </form>

      {/* ── Error banner ── */}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button className="btn btn-retry" onClick={loadTasks}>
            Retry
          </button>
        </div>
      )}

      {/* ── Loading state ── */}
      {state === 'loading' && (
        <p className="status-msg">Loading your tasks…</p>
      )}

      {/* ── Empty state ── */}
      {state === 'ready' && tasks.length === 0 && (
        <p className="status-msg empty">
          No tasks yet — add one above to get started!
        </p>
      )}

      {/* ── Task list ── */}
      {state === 'ready' && tasks.length > 0 && (
        <>
          <ul className="task-list" aria-label="Task list">
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </ul>
          <p className="task-summary">
            {remaining === 0
              ? '🎉 All tasks complete!'
              : `${remaining} task${remaining === 1 ? '' : 's'} remaining`}
          </p>
        </>
      )}
    </div>
  );
}
