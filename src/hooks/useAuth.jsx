import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Guest = anonymous Supabase user
  const isGuest = !!user?.is_anonymous;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(uid) {
    // Small delay for guest users to let the DB trigger create the profile
    let retries = 0;
    let data = null;
    while (retries < 5) {
      const res = await supabase.from('ttt_profiles').select('*').eq('id', uid).single();
      if (res.data) { data = res.data; break; }
      retries++;
      await new Promise(r => setTimeout(r, 300));
    }
    setProfile(data);
    setLoading(false);
  }

  async function signUp(email, password, { firstName, lastName, nickname }) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { first_name: firstName, last_name: lastName, nickname } }
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signInAsGuest() {
    // Generate a guest display name: "Guest #XXXX"
    const guestNum = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const displayName = `Guest #${guestNum}`;

    const { data, error } = await supabase.auth.signInAnonymously({
      options: { data: { display_name: displayName } }
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function updateProfile(updates) {
    if (!user) return;
    const { data, error } = await supabase
      .from('ttt_profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
    setProfile(data);
    return data;
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, isGuest, signUp, signIn, signInAsGuest, signOut, updateProfile, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
