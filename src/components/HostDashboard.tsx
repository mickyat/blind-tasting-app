'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { openResults } from '@/app/actions'
import { countRequiredScores } from '@/lib/results'
import type { CategoryRow, EventRow, ItemRow, ParameterRow, ParticipantRow } from '@/lib/types'

interface Props {
  hostToken: string
  event: EventRow
  items: ItemRow[]
  categories: CategoryRow[]
  parameters: ParameterRow[]
}

const VISIBILITY_LABELS: Record<string, string> = {
  manual: 'ידני',
  after_all_done: 'אחרי שכולם סיימו',
  live: 'חי',
}

export default function HostDashboard({ hostToken, event, items, categories, parameters }: Props) {
  const [supabase] = useState(() => createClient())
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [doneCounts, setDoneCounts] = useState<Record<string, number>>({})
  const [resultsOpen, setResultsOpen] = useState(event.results_open)
  const [opening, setOpening] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const requiredScores = countRequiredScores(items, categories, parameters)

  const refresh = useCallback(async () => {
    const { data: parts } = await supabase
      .from('participant')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true })
    setParticipants(parts ?? [])

    if (parts && parts.length > 0) {
      const ids = parts.map((p) => p.id)
      const { data: scores } = await supabase
        .from('score')
        .select('participant_id')
        .in('participant_id', ids)
      const counts: Record<string, number> = {}
      for (const s of scores ?? []) {
        counts[s.participant_id] = (counts[s.participant_id] ?? 0) + 1
      }
      setDoneCounts(counts)
    } else {
      setDoneCounts({})
    }
  }, [supabase, event.id])

  useEffect(() => {
    refresh()
    const channel = supabase
      .channel(`host-${event.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participant', filter: `event_id=eq.${event.id}` },
        () => refresh()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score' }, () => refresh())
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'event', filter: `id=eq.${event.id}` },
        (payload) => {
          const updated = payload.new as { results_open?: boolean }
          setResultsOpen(Boolean(updated.results_open))
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh, supabase, event.id])

  async function handleOpenResults() {
    setOpening(true)
    const result = await openResults(hostToken)
    setOpening(false)
    if ('ok' in result) setResultsOpen(true)
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareLink = `${origin}/e/${event.share_token}`
  const resultsLink = `${origin}/e/${event.share_token}/results`

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-4">
        <span className="text-xs font-medium text-zinc-500">קישור למשתתפים</span>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs text-zinc-700">
            {shareLink}
          </code>
          <button
            onClick={() => copy(shareLink, 'share')}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium"
          >
            {copied === 'share' ? 'הועתק!' : 'העתק'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-4">
        <span className="text-xs font-medium text-zinc-500">קישור למסך הקרנה / תוצאות</span>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs text-zinc-700">
            {resultsLink}
          </code>
          <button
            onClick={() => copy(resultsLink, 'results')}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium"
          >
            {copied === 'results' ? 'הועתק!' : 'העתק'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700">משתתפים ({participants.length})</h2>
        {participants.length === 0 ? (
          <p className="text-sm text-zinc-400">עדיין אף אחד לא הצטרף</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {participants.map((p) => {
              const done = doneCounts[p.id] ?? 0
              const isDone = done >= requiredScores
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-300 bg-white px-4 py-3"
                >
                  <span className="text-sm font-medium">{p.nickname}</span>
                  <span className={`text-xs ${isDone ? 'text-green-600' : 'text-zinc-400'}`}>
                    {done}/{requiredScores} {isDone ? '✓ סיים' : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-4">
        <span className="text-xs font-medium text-zinc-500">
          אופן חשיפת תוצאות: {VISIBILITY_LABELS[event.results_visibility]}
        </span>
        {event.results_visibility === 'manual' &&
          (resultsOpen ? (
            <p className="text-sm font-medium text-green-600">התוצאות פתוחות למשתתפים ✓</p>
          ) : (
            <button
              onClick={handleOpenResults}
              disabled={opening}
              className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {opening ? 'פותח…' : 'הצג תוצאות'}
            </button>
          ))}
        {event.results_visibility !== 'manual' && (
          <p className="text-xs text-zinc-500">התוצאות ייחשפו אוטומטית לפי ההגדרה שבחרת</p>
        )}
      </div>
    </div>
  )
}
