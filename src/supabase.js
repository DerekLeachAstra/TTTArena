import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bstziefqzxhtdjfcaele.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzdHppZWZxenhodGRqZmNhZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NTAxMzgsImV4cCI6MjA4NjQyNjEzOH0.SuDse5bRpzi1vLmv0PNXZC0WfqoVssJUHV2mR00k5a0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
