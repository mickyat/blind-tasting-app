import { createAdminClient } from '@/lib/supabase/admin'
import type { PlanRow } from '@/lib/types'

// Looks up a specific plan's limits by id - always the caller's actual
// event.plan_id or visitor_event_count.plan_id, never hardcoded, so
// upgrading a specific event/visitor to a paid tier later is a write to
// that row, not a code change. Every event/visitor currently defaults to
// 'free' at the DB level (there's no way yet to assign anything else).
export async function getPlan(planId: string): Promise<PlanRow | null> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('plan').select('*').eq('id', planId).maybeSingle()
  return data
}
