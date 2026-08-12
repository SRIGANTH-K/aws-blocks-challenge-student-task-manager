import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { authApi } from 'aws-blocks';
import AuthPanel from './AuthPanel';
import App from './App';
import './app.css';

function Root() {
  // null = still checking; string = signed-in username; false = not signed in
  const [user, setUser] = useState<string | null | false>(null);

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

  function refreshUser() {
    authApi.getAuthState()
      .then((state) => {
        if (state.state === 'signedIn' && state.user) {
          setUser(state.user.username);
        } else {
          setUser(false);
        }
      })
      .catch(() => setUser(false));
  }

  // ── Still checking ────────────────────────────────────────────────────────
  if (user === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  // ── Not signed in ─────────────────────────────────────────────────────────
  if (user === false) {
    return <AuthPanel onAuthenticated={refreshUser} />;
  }

  // ── Signed in ─────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <header className="header">
        <h1>📚 Student Task Manager</h1>
        <div className="header-user">
          <span>Hello, <strong>{user}</strong> 👋</span>
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
