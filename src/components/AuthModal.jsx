import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

function AuthModal({ isOpen, onClose }) {
  const { signIn, signUp } = useAuth();
  const [tab, setTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  function resetForm() { setEmail(''); setPassword(''); setDisplayName(''); setError(''); }
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
    if (!displayName.trim()) { setError('Display name is required'); return; }
    setLoading(true);
    try { await signUp(email, password, displayName.trim()); resetForm(); onClose(); }
    catch (err) { setError(err.message || 'Sign up failed'); }
    finally { setLoading(false); }
  }

  const inp = { width:'100%', background:'var(--s2)', border:'1px solid var(--bd)', color:'var(--tx)', fontFamily:"'DM Mono',monospace", fontSize:13, padding:'10px 12px', outline:'none' };
  const lbl = { fontSize:10, letterSpacing:2, textTransform:'uppercase', color:'var(--mu)', marginBottom:4, display:'block', fontFamily:"'DM Mono',monospace" };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(8,8,14,0.92)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }} onClick={onClose}>
      <div style={{ background:'var(--sf)', border:'1px solid var(--bd)', width:'100%', maxWidth:400 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid var(--bd)' }}>
          <span style={{ fontSize:12, letterSpacing:3, textTransform:'uppercase', color:'var(--tx)', fontFamily:"'DM Mono',monospace", fontWeight:500 }}>TTT Arena</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--mu)', fontSize:18, cursor:'pointer', fontFamily:"'DM Mono',monospace" }}>&times;</button>
        </div>
        <div style={{ display:'flex', borderBottom:'1px solid var(--bd)' }}>
          {['signin','signup'].map(t => (
            <button key={t} onClick={() => switchTab(t)} style={{
              flex:1, padding:'12px 0', background:'none', border:'none',
              borderBottom: tab===t ? '2px solid var(--ac)' : '2px solid transparent',
              color: tab===t ? 'var(--ac)' : 'var(--mu)', fontFamily:"'DM Mono',monospace",
              fontSize:10, letterSpacing:2.5, textTransform:'uppercase', cursor:'pointer', fontWeight:500
            }}>{t === 'signin' ? 'Sign In' : 'Sign Up'}</button>
          ))}
        </div>
        {error && <div style={{ padding:'14px 20px 0' }}><div style={{ background:'rgba(255,71,87,0.1)', border:'1px solid rgba(255,71,87,0.25)', color:'var(--rd)', fontSize:11, padding:'10px 12px' }}>{error}</div></div>}
        <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
          <div><label style={lbl}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="you@example.com" required /></div>
          <div><label style={lbl}>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} placeholder={tab==='signin'?'Enter password':'Choose a password'} required /></div>
          {tab === 'signup' && <div><label style={lbl}>Display Name</label><input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} style={inp} placeholder="Your arena name" required /></div>}
          <button type="submit" disabled={loading} style={{
            width:'100%', background: loading ? 'var(--bd)' : 'var(--ac)', color: loading ? 'var(--mu)' : 'var(--bg)',
            fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:3, textTransform:'uppercase',
            border:'none', padding:13, cursor: loading ? 'not-allowed' : 'pointer', fontWeight:500, marginTop:4
          }}>{loading ? (tab==='signin'?'Signing In...':'Creating Account...') : (tab==='signin'?'Sign In':'Sign Up')}</button>
        </form>
      </div>
    </div>
  );
}

export default AuthModal;
