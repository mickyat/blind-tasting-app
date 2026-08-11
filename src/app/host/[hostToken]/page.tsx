import { createAdminClient } from '@/lib/supabase/admin'
import HostDashboard from '@/components/HostDashboard'

export default async function HostPage(props: PageProps<'/host/[hostToken]'>) {
  const { hostToken } = await props.params
  const supabase = createAdminClient()

  const { data: admin } = await supabase
    .from('event_admin')
    .select('event_id')
    .eq('host_token', hostToken)
    .maybeSingle()

  if (!admin) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <h1 className="text-lg font-semibold">קישור ניהול לא תקין</h1>
        <p className="text-sm text-zinc-500">בדוק שהעתקת את הקישור המלא</p>
      </main>
    )
  }

  const [{ data: event }, { data: items }, { data: categories }] = await Promise.all([
    supabase.from('event').select('*').eq('id', admin.event_id).single(),
    supabase.from('item').select('*').eq('event_id', admin.event_id).order('sort_order'),
    supabase.from('category').select('*').eq('event_id', admin.event_id).order('sort_order'),
  ])

  const categoryIds = (categories ?? []).map((c) => c.id)
  const { data: parameters } =
    categoryIds.length > 0
      ? await supabase.from('parameter').select('*').in('category_id', categoryIds)
      : { data: [] }

  if (!event) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <h1 className="text-lg font-semibold">האירוע לא נמצא</h1>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-bold">{event.title}</h1>
        <p className="text-xs text-zinc-500">ניהול האירוע</p>
      </header>
      <HostDashboard
        hostToken={hostToken}
        event={event}
        items={items ?? []}
        parameters={parameters ?? []}
      />
    </main>
  )
}
