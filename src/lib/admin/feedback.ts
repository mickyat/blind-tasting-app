import { createAdminClient } from '@/lib/supabase/admin'

export interface FeedbackRow {
  id: string
  created_at: string
  event_ref: string | null
  message: string
  contact: string | null
  locale: string | null
}

export async function getFeedback(): Promise<FeedbackRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('feedback')
    .select('id, created_at, event_ref, message, contact, locale')
    .order('created_at', { ascending: false })
  return data ?? []
}
