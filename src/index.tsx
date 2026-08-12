/**
 * Frontend entry point — src/index.tsx
 *
 * Bootstraps the React app. Handles auth state at the top level:
 *   - Not signed in → show AuthPanel
 *   - Signed in     → show App (task manager)
 *
 * Auth state is checked via authApi.getAuthState() on mount.
 * authApi is the typed proxy for auth.createApi() — a state machine
 * that tells us whether the user is 'signedIn' or 'signedOut'.
 */
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { authApi } from 'aws-blocks';
import AuthPanel from './AuthPanel';
import App from './App';
import './app.css';

function Root() {
  // null = still checking; string = signed-in username; false = not signed in
  const [user, setUser] = useState<string | null | false>(null);

  // Check if a session already exists (e.g. page refresh while logged in)
  useEffect(() => {
    authApi.getAuthState()
      .then((state) => {
        if (state.state === 'signedIn' && state.user) {
          setUser(state.user.username);
        } else {
          setUser(false);
        }
      })
      .catch(() => setUser(false));
  }, []);

  async function handleSignOut() {
    try {
      await authApi.setAuthState({ action: 'signOut' });
    } finally {
      setUser(false);
    }
  }

  // Still checking auth state
  if (user === null) {
    return (
      <div className="page">
        <p className="status-msg">Loading…</p>
      </div>
    );
  }

  // Not signed in — show auth panel
  if (user === false) {
    return (
      <div className="page">
        <AuthPanel
          onAuthenticated={() => {
            authApi.getAuthState()
              .then((state) => {
                if (state.state === 'signedIn' && state.user) {
                  setUser(state.user.username);
                } else {
                  setUser(false);
                }
              })
              .catch(() => setUser(false));
          }}
        />
      </div>
    );
  }

  // Signed in — show task manager
  return (
    <div className="page">
      <header className="header">
        <h1>📚 Student Task Manager</h1>
        <div className="header-user">
          <span>Hello, <strong>{user}</strong></span>
          <button className="btn btn-signout" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </header>
      <App />
    </div>
  );
}

const container = document.getElementById('root')!;
createRoot(container).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
