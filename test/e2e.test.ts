/**
 * End-to-end tests — tests the API via direct imports (same typed client the frontend uses).
 *
 * Run:  npm run test:e2e
 *
 * Structure:
 *   - Setup (starts dev server, imports client) — don't touch
 *   - Auth tests
 *   - CRUD tests (listTasks, createTask, updateTask, toggleTask, deleteTask)
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { installCookieJar, isServerRunning } from '@aws-blocks/blocks/utils';
import type { api as ApiType, authApi as AuthApiType } from 'aws-blocks';

// Install cookie jar before importing the API client — Node's fetch doesn't
// persist cookies between requests, which breaks authenticated API calls.
installCookieJar();

let server: ChildProcess | null = null;
let api: typeof ApiType;
let authApi: typeof AuthApiType;

// ─── Setup (don't touch) ─────────────────────────────────────────────────────

test.before(async () => {
  // Use existing dev server if running, otherwise start one
  if (!await isServerRunning()) {
    server = spawn('npm', ['run', 'dev:server'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
      env: { ...process.env, NODE_OPTIONS: '' },
    });
    server.unref();
    await setTimeout(2000);
  }

  const mod = await import('aws-blocks');
  api = mod.api;
  authApi = mod.authApi;

  // Wait for server readiness
  for (let i = 0; i < 30; i++) {
    try {
      await authApi.getAuthState();
      return;
    } catch {
      await setTimeout(1000);
    }
  }
  throw new Error('Dev server did not become ready within 30s');
});

test.after(() => {
  if (server?.pid) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
  }
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

test('auth: starts signed out', async () => {
  const state = await authApi.getAuthState();
  assert.strictEqual(state.state, 'signedOut');
});

test('auth: sign up creates account and signs in', async () => {
  const state = await authApi.setAuthState({
    action: 'signUp',
    username: 'testuser',
    password: 'TestPass123!',
  });
  assert.strictEqual(state.state, 'signedIn');
  assert.strictEqual(state.user?.username, 'testuser');
});

test('auth: unauthenticated access is rejected', async () => {
  // Sign out first
  await authApi.setAuthState({ action: 'signOut' });

  await assert.rejects(
    () => api.listTasks(),
    (err: unknown) => {
      const msg = (err as Error).message ?? '';
      return msg.includes('Authentication') || msg.includes('Session') || msg.includes('401');
    },
  );

  // Sign back in for remaining tests
  await authApi.setAuthState({
    action: 'signIn',
    username: 'testuser',
    password: 'TestPass123!',
  });
});

// ─── CRUD ─────────────────────────────────────────────────────────────────────

test('tasks: create a task', async () => {
  const task = await api.createTask('Buy milk');
  assert.strictEqual(task.title, 'Buy milk');
  assert.strictEqual(task.completed, false);
  assert.ok(task.id);
  assert.ok(task.createdAt > 0);
  assert.strictEqual(task.userId, 'testuser');
});

test('tasks: list returns only own tasks', async () => {
  const list = await api.listTasks();
  assert.ok(list.length >= 1);
  assert.ok(list.every((t) => t.userId === 'testuser'));
});

test('tasks: update task title', async () => {
  const list = await api.listTasks();
  const task = list[0];
  const updated = await api.updateTask(task.id, 'Buy oat milk');
  assert.strictEqual(updated.title, 'Buy oat milk');
  assert.strictEqual(updated.id, task.id);
});

test('tasks: toggle completion', async () => {
  const list = await api.listTasks();
  const task = list[0];
  const toggled = await api.toggleTask(task.id);
  assert.strictEqual(toggled.completed, !task.completed);
  // Toggle back
  const back = await api.toggleTask(task.id);
  assert.strictEqual(back.completed, task.completed);
});

test('tasks: delete a task', async () => {
  // Create a throwaway task
  const task = await api.createTask('Delete me');
  const before = await api.listTasks();
  assert.ok(before.some((t) => t.id === task.id));

  await api.deleteTask(task.id);

  const after = await api.listTasks();
  assert.ok(!after.some((t) => t.id === task.id));
});

test('tasks: tasks persist across list calls', async () => {
  const first = await api.listTasks();
  const second = await api.listTasks();
  assert.strictEqual(first.length, second.length);
  assert.deepStrictEqual(
    first.map((t) => t.id),
    second.map((t) => t.id),
  );
});
