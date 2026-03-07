import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    // Also check if we already have a session (user clicked link and was auto-signed in)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  }

  const inp = {
    width: '100%', background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--tx)',
    fontFamily: "'DM Mono',monospace", fontSize: 13, padding: '10px 12px', outline: 'none', boxSizing: 'border-box'
  };
  const lbl = {
    fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)',
    marginBottom: 4, display: 'block', fontFamily: "'DM Mono',monospace"
  };

  if (success) {
    return (
      <div style={{ maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
        <div style={{
          background: 'var(--sf)', border: '1px solid var(--bd)', borderTop: '3px solid var(--gn)', padding: 40
        }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, letterSpacing: 2, color: 'var(--gn)', marginBottom: 12 }}>
            Password Updated
          </div>
          <div style={{ fontSize: 12, color: 'var(--mu)', letterSpacing: 1.5, lineHeight: 1.8 }}>
            Your password has been successfully changed. Redirecting to the arena...
          </div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
        <div style={{
          background: 'var(--sf)', border: '1px solid var(--bd)', borderTop: '3px solid var(--ac)', padding: 40
        }}>
          <div className="ai-thinking"><span>Verifying</span><span className="dot" /><span className="dot" /><span className="dot" /></div>
          <div style={{ fontSize: 11, color: 'var(--mu)', letterSpacing: 1.5, marginTop: 16 }}>
            Verifying your reset link...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <div style={{
        background: 'var(--sf)', border: '1px solid var(--bd)', borderTop: '3px solid var(--ac)', padding: 30
      }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2, color: 'var(--ac)', marginBottom: 6 }}>
          Reset Password
        </div>
        <div style={{ fontSize: 11, color: 'var(--mu)', letterSpacing: 1.5, marginBottom: 24, lineHeight: 1.6 }}>
          Enter your new password below.
        </div>

        {error && (
          <div style={{
            background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.25)',
            color: 'var(--rd)', fontSize: 11, padding: '10px 12px', marginBottom: 16
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inp}
              placeholder="At least 6 characters"
              required
            />
          </div>
          <div>
            <label style={lbl}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              style={inp}
              placeholder="Re-enter password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', background: loading ? 'var(--bd)' : 'var(--ac)',
              color: loading ? 'var(--mu)' : 'var(--bg)',
              fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: 3,
              textTransform: 'uppercase', border: 'none', padding: 13,
              cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 500, marginTop: 4
            }}
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
