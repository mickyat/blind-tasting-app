import { createAdminClient } from '@/lib/supabase/admin'
import type { PlanRow } from '@/lib/types'

// Every event is implicitly on the 'free' plan for now - there is no
// plan-assignment mechanism yet (no live payment system exists). Once one
// does, look up the plan actually assigned instead of hardcoding this id.
export async function getFreePlan(): Promise<PlanRow | null> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('plan').select('*').eq('id', 'free').maybeSingle()
  return data
}
