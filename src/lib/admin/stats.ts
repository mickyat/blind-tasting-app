import { createAdminClient } from '@/lib/supabase/admin'

export interface AdminStats {
  totalEvents: number
  eventsToday: number
  eventsThisWeek: number
  eventsThisMonth: number
  totalParticipants: number
  liveEventCount: number
  dailyTrend: { date: string; count: number }[] // last 30 days, oldest first, UTC calendar days
  templateBreakdown: { templateId: string | null; count: number }[] // sorted desc, null = "from scratch"
  localeBreakdown: { locale: 'he' | 'en' | 'unknown'; count: number }[]
}

// "Live" has no dedicated status field in the schema (see AGENTS/schema) -
// defined here as "at least one participant joined in the last 3 hours",
// the only recent-activity timestamp actually available (score/
// checklist_answer rows carry no timestamp of their own). A reasonable
// proxy for "people are actively at this event right now", not a precise
// signal - documented on the dashboard itself too.
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000
const TREND_DAYS = 30

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(x.getDate() - x.getDay())
  return x
}
function startOfMonth(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(1)
  return x
}

function buildDailyTrend(rows: { created_at: string }[], now: Date): { date: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = row.created_at.slice(0, 10) // YYYY-MM-DD, UTC (as stored)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const days: { date: string; count: number }[] = []
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = startOfDay(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ date: key, count: counts.get(key) ?? 0 })
  }
  return days
}

// Simple aggregation queries (COUNT/GROUP BY-equivalent), no BI tooling -
// fine at this app's scale. Runs fresh on every /admin page load (the page
// itself is force-dynamic); the "GROUP BY"-style breakdowns are done in JS
// after a plain select since Supabase-JS has no group-by helper, but the
// row counts involved are small (this is an internal tool, not analytics
// over millions of rows).
export async function getAdminStats(): Promise<AdminStats> {
  const supabase = createAdminClient()
  const now = new Date()

  const todayIso = startOfDay(now).toISOString()
  const weekIso = startOfWeek(now).toISOString()
  const monthIso = startOfMonth(now).toISOString()
  const trendSinceIso = (() => {
    const d = startOfDay(now)
    d.setDate(d.getDate() - (TREND_DAYS - 1))
    return d.toISOString()
  })()
  const liveWindowIso = new Date(now.getTime() - LIVE_WINDOW_MS).toISOString()

  const [
    totalEventsRes,
    eventsTodayRes,
    eventsThisWeekRes,
    eventsThisMonthRes,
    totalParticipantsRes,
    recentParticipantsRes,
    trendEventsRes,
    itemTypesRes,
    eventLocalesRes,
  ] = await Promise.all([
    supabase.from('event').select('id', { count: 'exact', head: true }),
    supabase.from('event').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
    supabase.from('event').select('id', { count: 'exact', head: true }).gte('created_at', weekIso),
    supabase.from('event').select('id', { count: 'exact', head: true }).gte('created_at', monthIso),
    supabase.from('participant').select('id', { count: 'exact', head: true }),
    supabase.from('participant').select('event_id').gte('created_at', liveWindowIso),
    supabase.from('event').select('created_at').gte('created_at', trendSinceIso),
    supabase.from('item_type').select('template'),
    supabase.from('event').select('locale'),
  ])

  const liveEventCount = new Set((recentParticipantsRes.data ?? []).map((p) => p.event_id)).size

  const templateCounts = new Map<string | null, number>()
  for (const row of itemTypesRes.data ?? []) {
    templateCounts.set(row.template, (templateCounts.get(row.template) ?? 0) + 1)
  }
  const templateBreakdown = [...templateCounts.entries()]
    .map(([templateId, count]) => ({ templateId, count }))
    .sort((a, b) => b.count - a.count)

  const localeCounts = { he: 0, en: 0, unknown: 0 }
  for (const row of eventLocalesRes.data ?? []) {
    if (row.locale === 'he') localeCounts.he++
    else if (row.locale === 'en') localeCounts.en++
    else localeCounts.unknown++
  }
  const localeBreakdown = (['he', 'en', 'unknown'] as const).map((locale) => ({
    locale,
    count: localeCounts[locale],
  }))

  return {
    totalEvents: totalEventsRes.count ?? 0,
    eventsToday: eventsTodayRes.count ?? 0,
    eventsThisWeek: eventsThisWeekRes.count ?? 0,
    eventsThisMonth: eventsThisMonthRes.count ?? 0,
    totalParticipants: totalParticipantsRes.count ?? 0,
    liveEventCount,
    dailyTrend: buildDailyTrend(trendEventsRes.data ?? [], now),
    templateBreakdown,
    localeBreakdown,
  }
}
