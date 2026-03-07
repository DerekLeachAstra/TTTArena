import { createClient } from '@supabase/supabase-js';

// Anon key is a public, client-safe key — access is governed by RLS policies.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bstziefqzxhtdjfcaele.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzdHppZWZxenhodGRqZmNhZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NTAxMzgsImV4cCI6MjA4NjQyNjEzOH0.SuDse5bRpzi1vLmv0PNXZC0WfqoVssJUHV2mR00k5a0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
