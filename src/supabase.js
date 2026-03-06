import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://btxmqwspajeahxkncovp.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0eG1xd3NwYWplYWh4a25jb3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjMzMjUsImV4cCI6MjA4ODM5OTMyNX0.D0aozkvJqWceXB0pjf7L99tPl0RkUaYAodpHWSLyjKA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
