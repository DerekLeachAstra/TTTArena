import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { supabase } from './src/supabase.js'
import Auth from './src/Auth.jsx'
import App from './App.jsx'
import PublicHome from './src/PublicHome.jsx'

function Root() {
  const [session, setSession] = useState(undefined)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) setShowAuth(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div style={{ minHeight:"100vh", background:"#0a0a0f", display:"flex", alignItems:"center", justifyContent:"center", color:"#6b6b80", fontFamily:"monospace", fontSize:12, letterSpacing:2 }}>
        LOADING...
      </div>
    )
  }

  if (session) return <App session={session} />
  if (showAuth) return <Auth onBack={() => setShowAuth(false)} />
  return <PublicHome onSignIn={() => setShowAuth(true)} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
