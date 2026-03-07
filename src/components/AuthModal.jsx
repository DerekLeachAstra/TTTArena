import { useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { checkNickname } from '../lib/profanityFilter';

function AuthModal({ isOpen, onClose }) {
  const { signIn, signUp } = useAuth();
  const [tab, setTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // Generate a stable 5-digit tag for this session
  const tag = useMemo(() => String(Math.floor(Math.random() * 100000)).padStart(5, '0'), []);

  if (!isOpen) return null;

  function resetForm() { setEmail(''); setPassword(''); setFirstName(''); setLastName(''); setNickname(''); setError(''); setResetSent(false); setShowForgot(false); }
  function switchTab(t) { setTab(t); resetForm(); }

  async function handleSignIn(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try { await signIn(email, password); resetForm(); onClose(); }
    catch (err) { setError(err.message || 'Sign in failed'); }
    finally { setLoading(false); }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setError('');
    if (!firstName.trim()) { setError('First name is required'); return; }
    if (!nickname.trim()) { setError('Nickname is required'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(nickname.trim())) { setError('Nickname can only contain letters, numbers, and underscores'); return; }
    const nickCheck = checkNickname(nickname.trim());
    if (nickCheck.blocked) { setError(nickCheck.reason); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await signUp(email, password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nickname: nickname.trim(),
      });
      resetForm();
      onClose();
    }
    catch (err) { setError(err.message || 'Sign up failed'); }
    finally { setLoading(false); }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Please enter your email address'); return; }
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/reset-password',
      });
      if (resetError) throw resetError;
      setResetSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email');
    } finally { setLoading(false); }
  }

  const inp = { width: '100%', background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--tx)', fontFamily: "'DM Mono',monospace", fontSize: 13, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' };
  const lbl = { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 4, display: 'block', fontFamily: "'DM Mono',monospace" };

  const usernamePreview = nickname.trim() ? `${nickname.trim().toLowerCase()}#${tag}` : '';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,8,14,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--bd)' }}>
          <span style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--tx)', fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>TTT Arena</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 18, cursor: 'pointer', fontFamily: "'DM Mono',monospace" }}>&times;</button>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--bd)' }}>
          {['signin', 'signup'].map(t => (
            <button key={t} onClick={() => switchTab(t)} style={{
              flex: 1, padding: '12px 0', background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid var(--ac)' : '2px solid transparent',
              color: tab === t ? 'var(--ac)' : 'var(--mu)', fontFamily: "'DM Mono',monospace",
              fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500
            }}>{t === 'signin' ? 'Sign In' : 'Sign Up'}</button>
          ))}
        </div>
        {error && <div style={{ padding: '14px 20px 0' }}><div style={{ background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.25)', color: 'var(--rd)', fontSize: 11, padding: '10px 12px' }}>{error}</div></div>}

        {/* Forgot Password View */}
        {showForgot ? (
          <div style={{ padding: 20 }}>
            {resetSent ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, letterSpacing: 2, color: 'var(--gn)', marginBottom: 10 }}>
                  Check Your Email
                </div>
                <div style={{ fontSize: 11, color: 'var(--mu)', letterSpacing: 1.5, lineHeight: 1.8, marginBottom: 20 }}>
                  We sent a password reset link to <span style={{ color: 'var(--ac)' }}>{email}</span>.
                  Click the link in the email to set a new password.
                </div>
                <button
                  onClick={() => { setShowForgot(false); setResetSent(false); setError(''); }}
                  style={{
                    background: 'none', border: '1px solid var(--bd)', color: 'var(--mu)',
                    fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2,
                    textTransform: 'uppercase', padding: '10px 20px', cursor: 'pointer',
                  }}
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 2, color: 'var(--ac)' }}>
                  Reset Password
                </div>
                <div style={{ fontSize: 11, color: 'var(--mu)', letterSpacing: 1, lineHeight: 1.6 }}>
                  Enter your email and we'll send you a link to reset your password.
                </div>
                <div>
                  <label style={lbl}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="you@example.com" required />
                </div>
                <button type="submit" disabled={loading} style={{
                  width: '100%', background: loading ? 'var(--bd)' : 'var(--ac)', color: loading ? 'var(--mu)' : 'var(--bg)',
                  fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
                  border: 'none', padding: 13, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 500
                }}>{loading ? 'Sending...' : 'Send Reset Link'}</button>
                <button
                  type="button"
                  onClick={() => { setShowForgot(false); setError(''); }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--mu)',
                    fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2,
                    textTransform: 'uppercase', cursor: 'pointer', padding: '4px 0',
                  }}
                >
                  Back to Sign In
                </button>
              </form>
            )}
          </div>
        ) : (
          /* Normal Sign In / Sign Up Form */
          <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label style={lbl}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="you@example.com" required /></div>
            <div><label style={lbl}>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} placeholder={tab === 'signin' ? 'Enter password' : 'Choose a password'} required /></div>

            {tab === 'signin' && (
              <button
                type="button"
                onClick={() => { setShowForgot(true); setError(''); }}
                style={{
                  background: 'none', border: 'none', color: 'var(--mu)', textAlign: 'right',
                  fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 1.5,
                  cursor: 'pointer', padding: 0, marginTop: -8,
                  transition: 'color 0.15s',
                }}
                onMouseOver={e => e.target.style.color = 'var(--ac)'}
                onMouseOut={e => e.target.style.color = 'var(--mu)'}
              >
                Forgot Password?
              </button>
            )}

            {tab === 'signup' && (
              <>
                {/* First Name + Last Name row */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>First Name *</label>
                    <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} style={inp} placeholder="First" required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Last Name</label>
                    <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} style={inp} placeholder="Last" />
                  </div>
                </div>

                {/* Nickname + Tag row */}
                <div>
                  <label style={lbl}>Nickname *</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                    <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} style={{ ...inp, flex: 1 }} placeholder="Your arena name" required />
                    <div style={{
                      display: 'flex', alignItems: 'center', padding: '0 14px',
                      background: 'var(--s2)', border: '1px solid var(--bd)',
                      fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3,
                      color: 'var(--hl)', whiteSpace: 'nowrap', userSelect: 'none'
                    }}>
                      #{tag}
                    </div>
                  </div>
                  {usernamePreview && (
                    <div style={{ marginTop: 6, fontSize: 10, letterSpacing: 1.5, color: 'var(--mu)', fontFamily: "'DM Mono',monospace" }}>
                      Username: <span style={{ color: 'var(--ac)' }}>{usernamePreview}</span>
                      <span style={{ fontSize: 9, color: 'var(--mu)', opacity: 0.6 }}> (preview — final tag assigned by server)</span>
                    </div>
                  )}
                </div>
              </>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', background: loading ? 'var(--bd)' : 'var(--ac)', color: loading ? 'var(--mu)' : 'var(--bg)',
              fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
              border: 'none', padding: 13, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 500, marginTop: 4
            }}>{loading ? (tab === 'signin' ? 'Signing In...' : 'Creating Account...') : (tab === 'signin' ? 'Sign In' : 'Sign Up')}</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default AuthModal;
