import React, { useState } from 'react';

interface AuthModalProps {
  onAuthenticate: (apiKey: string) => Promise<boolean>;
  errorMessage?: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthenticate, errorMessage }) => {
  const [apiKey, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(errorMessage || null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const success = await onAuthenticate(apiKey.trim());
      if (!success) {
        setError('Authentication failed. Invalid API key.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(9, 13, 22, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: 32,
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div className="logo-mark">T</div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Traceo Access Control</h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Enter your deployment API key to unlock the dashboard.
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: 'var(--accent-rose)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              marginBottom: 16
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="traceo-api-key"
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}
            >
              API Key Credential
            </label>
            <input
              id="traceo-api-key"
              type="password"
              className="search-input"
              placeholder="e.g. tr_live_secret_key..."
              value={apiKey}
              onChange={(e) => setApiKeyInput(e.target.value)}
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 16px',
              backgroundColor: 'var(--accent-indigo)',
              color: '#fff',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.15s ease'
            }}
          >
            {loading ? 'Verifying Credential...' : 'Unlock Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
};
