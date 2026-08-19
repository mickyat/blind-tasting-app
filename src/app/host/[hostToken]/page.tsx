import { getTranslations } from 'next-intl/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFreePlan } from '@/lib/plans'
import HostDashboard from '@/components/HostDashboard'

export default async function HostPage(props: PageProps<'/host/[hostToken]'>) {
  const { hostToken } = await props.params
  const t = await getTranslations('hostPage')
  const supabase = createAdminClient()

  const { data: admin } = await supabase
    .from('event_admin')
    .select('event_id')
    .eq('host_token', hostToken)
    .maybeSingle()

  if (!admin) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <h1 className="text-lg font-semibold">{t('invalidLink')}</h1>
        <p className="text-sm text-zinc-500">{t('invalidLinkHint')}</p>
      </main>
    )
  }

  const { data: event } = await supabase.from('event').select('*').eq('id', admin.event_id).single()

  if (!event) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <h1 className="text-lg font-semibold">{t('eventNotFound')}</h1>
      </main>
    )
  }

  const { data: itemTypes } = await supabase
    .from('item_type')
    .select('*')
    .eq('event_id', admin.event_id)
    .order('sort_order')

  const itemTypeIds = (itemTypes ?? []).map((t) => t.id)

  const [{ data: items }, { data: categories }] =
    itemTypeIds.length > 0
      ? await Promise.all([
          supabase.from('item').select('*').in('item_type_id', itemTypeIds).order('sort_order'),
          supabase.from('category').select('*').in('item_type_id', itemTypeIds).order('sort_order'),
        ])
      : [{ data: [] }, { data: [] }]

  const categoryIds = (categories ?? []).map((c) => c.id)
  const { data: parameters } =
    categoryIds.length > 0
      ? await supabase.from('parameter').select('*').in('category_id', categoryIds)
      : { data: [] }

  const { data: externalCriteria } =
    itemTypeIds.length > 0
      ? await supabase.from('external_criterion').select('*').in('item_type_id', itemTypeIds).order('sort_order')
      : { data: [] }

  const itemIds = (items ?? []).map((i) => i.id)
  const { data: externalValues } =
    itemIds.length > 0
      ? await supabase.from('item_external_value').select('*').in('item_id', itemIds)
      : { data: [] }

  const plan = await getFreePlan()

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-bold">{event.title}</h1>
        <p className="text-xs text-zinc-500">{t('subtitle')}</p>
      </header>
      <HostDashboard
        hostToken={hostToken}
        event={event}
        items={items ?? []}
        categories={categories ?? []}
        parameters={parameters ?? []}
        externalCriteria={externalCriteria ?? []}
        externalValues={externalValues ?? []}
        maxParticipants={plan?.max_participants_per_event ?? null}
      />
    </main>
  )
}
