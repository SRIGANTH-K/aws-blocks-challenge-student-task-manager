import React, { useState, useEffect, useCallback } from 'react';
import { api } from 'aws-blocks';
import type { Task } from 'aws-blocks';
import './app.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppState = 'loading' | 'ready' | 'error';

interface TaskItemProps {
  task: Task;
  index: number;
  onToggle: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

// ─── TaskItem ─────────────────────────────────────────────────────────────────

function TaskItem({ task, index, onToggle, onEdit, onDelete }: TaskItemProps) {
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
    <li
      className={`task-item${task.completed ? ' task-completed' : ''}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Custom checkbox */}
      <div className="task-checkbox-wrap">
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
      </div>

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
            ✏️ Edit
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
            🗑️ Delete
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

  async function handleToggle(id: string) {
    setError('');
    try {
      const updated = await api.toggleTask(id);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task.');
      await loadTasks();
    }
  }

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

  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const remaining = total - done;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="app-content">

      {/* ── Progress bar (only when there are tasks) ── */}
      {total > 0 && (
        <div className="progress-bar-wrap">
          <div className="progress-label">
            <span>Progress</span>
            <span>{pct}% complete</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* ── New task form ── */}
      <form className="new-task-form" onSubmit={handleCreate}>
        <input
          className="new-task-input"
          type="text"
          placeholder="What do you need to do today?"
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
          {creating ? '⏳ Adding…' : '+ Add Task'}
        </button>
      </form>

      {/* ── Error banner ── */}
      {error && (
        <div className="error-banner" role="alert">
          <span className="error-icon">⚠️</span>
          {error}
          <button className="btn btn-retry" onClick={loadTasks}>
            Retry
          </button>
        </div>
      )}

      {/* ── Loading state ── */}
      {state === 'loading' && (
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading your tasks…</span>
        </div>
      )}

      {/* ── Empty state ── */}
      {state === 'ready' && tasks.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">🎯</span>
          <p className="empty-title">No tasks yet</p>
          <p className="empty-sub">Add your first task above to get started!</p>
        </div>
      )}

      {/* ── Task list ── */}
      {state === 'ready' && tasks.length > 0 && (
        <>
          <ul className="task-list" aria-label="Task list">
            {tasks.map((task, i) => (
              <TaskItem
                key={task.id}
                task={task}
                index={i}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </ul>

          <div className="task-footer">
            {remaining === 0 ? (
              <p className="task-summary task-summary-done">
                🎉 All tasks complete!
              </p>
            ) : (
              <p className="task-summary">
                {remaining} task{remaining === 1 ? '' : 's'} remaining
                <span className="task-count-badge">{remaining}</span>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
