import { createClient } from '@supabase/supabase-js'

// Plain anon-key client for server-side reads of publicly-readable data
// (event / item / parameter). No auth/session handling needed - this app
// has no login.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
