import { useState } from 'react'
import { supabase } from './supabase.js'

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' or 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email for a confirmation link!')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      }
    }
    setLoading(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        :root{
          --bg:#0a0a0f;--sf:#111118;--s2:#18181f;--s3:#1e1e28;
          --ac:#e8ff47;--tx:#f0f0f5;--mu:#6b6b80;--bd:#2a2a3a;
          --gn:#47ff9a;--rd:#ff4757;
        }
        body{background:var(--bg);color:var(--tx);font-family:'DM Mono',monospace;}
      `}</style>
      <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, backgroundImage:"linear-gradient(var(--s3) 1px,transparent 1px),linear-gradient(90deg,var(--s3) 1px,transparent 1px)", backgroundSize:"40px 40px", opacity:0.3 }}/>
        <div style={{ position:"relative", zIndex:1, width:"100%", maxWidth:400, padding:"0 18px" }}>
          <div style={{ textAlign:"center", marginBottom:40 }}>
            <div style={{ fontSize:10, letterSpacing:4, color:"var(--ac)", textTransform:"uppercase", marginBottom:8 }}>League Manager & Game Hub</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(44px,7vw,76px)", lineHeight:0.9, letterSpacing:3 }}>
              TTT<span style={{ color:"var(--ac)", display:"block" }}>ARENA</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ background:"var(--sf)", border:"1px solid var(--bd)", padding:28, display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ textAlign:"center", fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:4 }}>
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </div>

            {error && (
              <div style={{ fontSize:11, color:"var(--rd)", background:"rgba(255,71,87,0.08)", border:"1px solid rgba(255,71,87,0.2)", padding:"8px 12px", textAlign:"center" }}>
                {error}
              </div>
            )}

            {message && (
              <div style={{ fontSize:11, color:"var(--gn)", background:"rgba(71,255,154,0.08)", border:"1px solid rgba(71,255,154,0.2)", padding:"8px 12px", textAlign:"center" }}>
                {message}
              </div>
            )}

            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <label style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)" }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)",
                  fontFamily:"'DM Mono',monospace", fontSize:13, padding:"10px 12px", outline:"none"
                }}
              />
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <label style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)" }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                style={{
                  background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)",
                  fontFamily:"'DM Mono',monospace", fontSize:13, padding:"10px 12px", outline:"none"
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                background:"var(--ac)", color:"var(--bg)", fontFamily:"'DM Mono',monospace",
                fontSize:11, letterSpacing:3, textTransform:"uppercase", border:"none",
                padding:"12px 18px", cursor: loading ? "wait" : "pointer", fontWeight:500, marginTop:4,
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>

            <div style={{ textAlign:"center", fontSize:11, color:"var(--mu)", marginTop:4 }}>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <span
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setMessage(null); }}
                style={{ color:"var(--ac)", cursor:"pointer", textDecoration:"underline" }}
              >
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </span>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
