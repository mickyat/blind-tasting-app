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

  const [{ data: items }, { data: parameters }] = await Promise.all([
    supabase.from('item').select('*').eq('event_id', event.id).order('sort_order'),
    supabase.from('parameter').select('*').eq('event_id', event.id).order('sort_order'),
  ])

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-bold">{event.title}</h1>
        <p className="text-xs text-zinc-500">תוצאות</p>
      </header>
      <ResultsView event={event} items={items ?? []} parameters={parameters ?? []} />
    </main>
  )
}
