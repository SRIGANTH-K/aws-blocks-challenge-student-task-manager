/**
 * AuthPanel — handles sign up and sign in using AuthBasic via the authApi proxy.
 *
 * authApi is the state-machine API returned by auth.createApi() on the backend.
 * We call setAuthState({ action, ...fields }) to advance auth through:
 *   signIn   → signed in
 *   signUp   → signed in (no codeDelivery configured, so immediate)
 *   signOut  → signed out
 */
import React, { useState } from 'react';
import { authApi } from 'aws-blocks';

type AuthMode = 'signin' | 'signup';

interface AuthPanelProps {
  onAuthenticated: () => void;
}

export default function AuthPanel({ onAuthenticated }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const u = username.trim();
    const p = password;

    if (!u || !p) {
      setError('Username and password are required.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        // Sign up first; since no codeDelivery is configured, the user is
        // immediately confirmed. Then sign in.
        const signUpResult = await authApi.setAuthState({ action: 'signUp', username: u, password: p });
        if (signUpResult.state !== 'signedIn') {
          // If signup left us not signed in, follow up with a sign-in
          const signInResult = await authApi.setAuthState({ action: 'signIn', username: u, password: p });
          if (signInResult.state !== 'signedIn') {
            setError(signInResult.error ?? 'Sign in failed after sign up.');
            return;
          }
        }
      } else {
        const result = await authApi.setAuthState({ action: 'signIn', username: u, password: p });
        if (result.state !== 'signedIn') {
          setError(result.error ?? 'Incorrect username or password.');
          return;
        }
      }
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>Student Task Manager</h2>

      <div className="auth-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={mode === 'signin'}
          className={`auth-tab${mode === 'signin' ? ' active' : ''}`}
          onClick={() => { setMode('signin'); setError(''); }}
        >
          Sign In
        </button>
        <button
          role="tab"
          aria-selected={mode === 'signup'}
          className={`auth-tab${mode === 'signup' ? ' active' : ''}`}
          onClick={() => { setMode('signup'); setError(''); }}
        >
          Sign Up
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="auth-username">Username</label>
          <input
            id="auth-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
            placeholder="e.g. alice"
          />
        </div>

        <div className="form-group">
          <label htmlFor="auth-password">
            Password{' '}
            {mode === 'signup' && (
              <span style={{ fontWeight: 400, color: '#888' }}>(min 8 characters)</span>
            )}
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy
            ? mode === 'signup' ? 'Creating account…' : 'Signing in…'
            : mode === 'signup' ? 'Create Account' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
