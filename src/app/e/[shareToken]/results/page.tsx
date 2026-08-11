import { createPublicClient } from '@/lib/supabase/public'
import ResultsView from '@/components/ResultsView'

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

  const [{ data: items }, { data: categories }] = await Promise.all([
    supabase.from('item').select('*').eq('event_id', event.id).order('sort_order'),
    supabase.from('category').select('*').eq('event_id', event.id).order('sort_order'),
  ])

  const categoryIds = (categories ?? []).map((c) => c.id)
  const { data: parameters } =
    categoryIds.length > 0
      ? await supabase.from('parameter').select('*').in('category_id', categoryIds).order('sort_order')
      : { data: [] }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-bold">{event.title}</h1>
        <p className="text-xs text-zinc-500">תוצאות</p>
      </header>
      <ResultsView
        event={event}
        items={items ?? []}
        categories={categories ?? []}
        parameters={parameters ?? []}
      />
    </main>
  )
}
