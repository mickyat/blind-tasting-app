import type { Metadata } from 'next'
import { requireAdminSession } from '@/lib/admin/auth'
import { getAdminStats } from '@/lib/admin/stats'
import { adminLogout } from './actions'

export const metadata: Metadata = {
  title: 'לוח בקרה - ניהול',
  robots: { index: false, follow: false },
}

// Reads via requireAdminSession's cookies() call already forces this route
// to be dynamic, but set it explicitly - this page must never serve a
// cached/stale snapshot of another admin's (or an old) session's data.
export const dynamic = 'force-dynamic'

const TEMPLATE_LABELS: Record<string, string> = {
  wine: 'יין חברתי',
  wine_pro: 'יין מקצועי - טעימה שיטתית',
  meat: 'בשר',
  beer: 'בירה',
  coffee: 'קפה',
  whiskey: 'וויסקי',
  cheese: 'גבינות',
  sausage: 'נקניקיות',
  burger: 'המבורגר',
  pizza: 'פיצה',
  general_vote: 'תחרות / הצבעה כללית',
}

function templateLabel(id: string | null): string {
  if (id === null) return 'התחלה מאפס (מותאם אישית)'
  return TEMPLATE_LABELS[id] ?? id
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-300 bg-white p-4">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <span className="text-2xl font-bold text-zinc-900">{value}</span>
    </div>
  )
}

export default async function AdminDashboardPage() {
  await requireAdminSession()
  const stats = await getAdminStats()

  const maxTrend = Math.max(1, ...stats.dailyTrend.map((d) => d.count))
  const maxTemplate = Math.max(1, ...stats.templateBreakdown.map((t) => t.count))
  const totalLocaleEvents = stats.localeBreakdown.reduce((a, l) => a + l.count, 0) || 1

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">לוח בקרה</h1>
        <div className="flex items-center gap-2">
          <a href="/admin" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700">
            רענן נתונים
          </a>
          <form action={adminLogout}>
            <button type="submit" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-500">
              התנתקות
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="סה״כ אירועים" value={stats.totalEvents} />
        <StatCard label="סה״כ משתתפים" value={stats.totalParticipants} />
        <StatCard label="אירועים חיים כרגע" value={stats.liveEventCount} />
        <StatCard label="אירועים היום" value={stats.eventsToday} />
        <StatCard label="אירועים השבוע" value={stats.eventsThisWeek} />
        <StatCard label="אירועים החודש" value={stats.eventsThisMonth} />
      </div>
      <p className="-mt-4 text-xs text-zinc-400">
        &quot;חי&quot; מוגדר כאן כאירוע שבו הצטרף משתתף חדש ב-3 השעות האחרונות (אין שדה סטטוס ייעודי בסכימה).
      </p>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-700">אירועים חדשים ביום, 30 הימים האחרונים</h2>
        <div className="flex h-32 items-end gap-[3px]">
          {stats.dailyTrend.map((d) => (
            <div key={d.date} className="group relative flex-1">
              <div
                className="w-full rounded-t bg-zinc-800"
                style={{ height: `${Math.max(2, (d.count / maxTrend) * 100)}%` }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">
                {d.date}: {d.count}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-700">פילוח לפי תבנית (לפי סוגי פריטים בכל האירועים)</h2>
        {stats.templateBreakdown.length === 0 ? (
          <p className="text-sm text-zinc-400">אין עדיין נתונים</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {stats.templateBreakdown.map((t) => (
              <li key={t.templateId ?? '__scratch__'} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-700">{templateLabel(t.templateId)}</span>
                  <span className="font-medium text-zinc-900">{t.count}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-zinc-700"
                    style={{ width: `${(t.count / maxTemplate) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-700">פילוח לפי שפת יצירה</h2>
        <ul className="flex flex-col gap-2">
          {stats.localeBreakdown.map((l) => (
            <li key={l.locale} className="flex items-center justify-between text-sm">
              <span className="text-zinc-700">
                {l.locale === 'he' ? 'עברית' : l.locale === 'en' ? 'אנגלית' : 'לא ידוע (אירועים ישנים)'}
              </span>
              <span className="font-medium text-zinc-900">
                {l.count} ({Math.round((l.count / totalLocaleEvents) * 100)}%)
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
