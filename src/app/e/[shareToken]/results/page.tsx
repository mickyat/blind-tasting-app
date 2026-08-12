import { createPublicClient } from '@/lib/supabase/public'
import ResultsView from '@/components/ResultsView'
import { THEME_STYLES } from '@/lib/theme'
import type { EventRow } from '@/lib/types'

export default async function ResultsPage(props: PageProps<'/e/[shareToken]/results'>) {
  const { shareToken } = await props.params
  const supabase = createPublicClient()

  const { data: event } = await supabase
    .from('event')
    .select('*')
    .eq('share_token', shareToken)
    .maybeSingle()

  if (!event) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <h1 className="text-lg font-semibold">אירוע לא נמצא</h1>
      </main>
    )
  }

  const { data: itemTypes } = await supabase
    .from('item_type')
    .select('*')
    .eq('event_id', event.id)
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
      ? await supabase.from('parameter').select('*').in('category_id', categoryIds).order('sort_order')
      : { data: [] }

  const ev = event as EventRow
  const theme = THEME_STYLES[ev.theme]

  return (
    <main className={`flex-1 ${theme.bg}`}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
        <header className="flex flex-col items-center gap-2 text-center">
          {ev.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ev.logo_url} alt="" className="h-16 w-16 rounded-lg object-contain" />
          )}
          <h1 className={`text-xl font-bold ${theme.accent}`}>{ev.title}</h1>
          <p className="text-xs text-zinc-500">תוצאות</p>
        </header>
        <ResultsView
          event={ev}
          itemTypes={itemTypes ?? []}
          items={items ?? []}
          categories={categories ?? []}
          parameters={parameters ?? []}
        />
      </div>
    </main>
  )
}
