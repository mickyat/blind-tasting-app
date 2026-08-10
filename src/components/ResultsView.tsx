'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateResults, rankResults } from '@/lib/results'
import type { EventRow, ItemRow, ParameterRow, ParticipantRow, ScoreRow } from '@/lib/types'

interface Props {
  event: EventRow
  items: ItemRow[]
  parameters: ParameterRow[]
}

export default function ResultsView({ event, items, parameters }: Props) {
  const [supabase] = useState(() => createClient())
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [resultsOpen, setResultsOpen] = useState(event.results_open)

  const requiredPerParticipant = items.length * parameters.length

  const refresh = useCallback(async () => {
    const { data: parts } = await supabase.from('participant').select('*').eq('event_id', event.id)
    setParticipants(parts ?? [])

    const itemIds = items.map((i) => i.id)
    if (itemIds.length > 0) {
      const { data: sc } = await supabase.from('score').select('*').in('item_id', itemIds)
      setScores(sc ?? [])
    }
  }, [supabase, event.id, items])

  useEffect(() => {
    refresh()
    const channel = supabase
      .channel(`results-${event.id}`)
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

  const doneCounts: Record<string, number> = {}
  for (const s of scores) {
    doneCounts[s.participant_id] = (doneCounts[s.participant_id] ?? 0) + 1
  }
  const participantsDone = participants.filter(
    (p) => (doneCounts[p.id] ?? 0) >= requiredPerParticipant
  ).length

  let shouldShow = false
  if (event.results_visibility === 'live') shouldShow = true
  else if (event.results_visibility === 'after_all_done') {
    shouldShow = participants.length > 0 && participantsDone === participants.length
  } else {
    shouldShow = resultsOpen
  }

  if (!shouldShow) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
        {event.results_visibility === 'after_all_done' ? (
          <>
            <p className="text-base font-medium text-zinc-700">מחכים שכולם יסיימו לדרג</p>
            <p className="text-sm text-zinc-500">
              {participantsDone}/{participants.length || 0} משתתפים סיימו
            </p>
          </>
        ) : (
          <p className="text-base font-medium text-zinc-700">מחכים שהמארגן יפתח את התוצאות</p>
        )}
      </div>
    )
  }

  const ranked = rankResults(calculateResults(items, parameters, scores))

  return (
    <div className="flex flex-col gap-3">
      {ranked.map((r, i) => (
        <div
          key={r.item.id}
          className={`flex items-center justify-between rounded-xl border p-4 ${
            i === 0
              ? 'border-amber-400 bg-amber-50'
              : 'border-zinc-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-zinc-400">#{i + 1}</span>
            <div className="flex flex-col">
              <span className="text-base font-semibold text-zinc-900">
                {i === 0 && '🏆 '}
                {r.item.label}
              </span>
              {r.participantCount > 0 && (
                <span className="text-xs text-zinc-500">{r.participantCount} דירוגים</span>
              )}
            </div>
          </div>
          <span className="text-lg font-bold text-zinc-900">
            {r.finalScore !== null ? r.finalScore.toFixed(2) : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}
