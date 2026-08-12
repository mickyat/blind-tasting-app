'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { openResults, openItemResults } from '@/app/actions'
import { buildAnsweredSet, isItemDone } from '@/lib/results'
import type {
  CategoryRow,
  ChecklistAnswerRow,
  EventRow,
  ItemRow,
  ParameterRow,
  ParticipantRow,
  ScoreRow,
} from '@/lib/types'

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
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [checklistAnswers, setChecklistAnswers] = useState<ChecklistAnswerRow[]>([])
  const [itemsState, setItemsState] = useState<ItemRow[]>(items)
  const [opening, setOpening] = useState(false)
  const [openingItemId, setOpeningItemId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [reminded, setReminded] = useState<Record<string, boolean>>({})

  const refresh = useCallback(async () => {
    const { data: parts } = await supabase
      .from('participant')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true })
    setParticipants(parts ?? [])

    if (parts && parts.length > 0) {
      const ids = parts.map((p) => p.id)
      const [{ data: sc }, { data: ca }] = await Promise.all([
        supabase.from('score').select('*').in('participant_id', ids),
        supabase.from('checklist_answer').select('*').in('participant_id', ids),
      ])
      setScores(sc ?? [])
      setChecklistAnswers(ca ?? [])
    } else {
      setScores([])
      setChecklistAnswers([])
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_answer' }, () => refresh())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'item' }, (payload) => {
        const updated = payload.new as { id: string; results_open?: boolean }
        setItemsState((prev) =>
          prev.map((i) => (i.id === updated.id ? { ...i, results_open: Boolean(updated.results_open) } : i))
        )
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh, supabase, event.id])

  const answered = useMemo(() => buildAnsweredSet(scores, checklistAnswers), [scores, checklistAnswers])

  async function handleOpenResults() {
    setOpening(true)
    const result = await openResults(hostToken)
    setOpening(false)
    if ('ok' in result) {
      setItemsState((prev) => prev.map((i) => ({ ...i, results_open: true })))
    }
  }

  async function handleOpenItemResults(itemId: string) {
    setOpeningItemId(itemId)
    const result = await openItemResults(hostToken, itemId)
    setOpeningItemId(null)
    if ('ok' in result) {
      setItemsState((prev) => prev.map((i) => (i.id === itemId ? { ...i, results_open: true } : i)))
    }
  }

  function sendReminder(participantId: string) {
    const channel = supabase.channel(`participant-${participantId}`)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({ type: 'broadcast', event: 'reminder', payload: {} })
        setTimeout(() => supabase.removeChannel(channel), 1000)
      }
    })
    setReminded((prev) => ({ ...prev, [participantId]: true }))
    setTimeout(() => setReminded((prev) => ({ ...prev, [participantId]: false })), 2000)
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
              const doneItems = itemsState.filter((item) =>
                isItemDone(p.id, item, categories, parameters, answered)
              )
              const pendingItems = itemsState.filter(
                (item) => !isItemDone(p.id, item, categories, parameters, answered)
              )
              const isDone = pendingItems.length === 0
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-1 rounded-xl border border-zinc-300 bg-white px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{p.nickname}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${isDone ? 'text-green-600' : 'text-zinc-400'}`}>
                        {doneItems.length}/{itemsState.length} {isDone ? '✓ סיים' : ''}
                      </span>
                      {!isDone && (
                        <button
                          type="button"
                          onClick={() => sendReminder(p.id)}
                          className="shrink-0 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600"
                        >
                          {reminded[p.id] ? 'נשלח!' : 'שלח תזכורת'}
                        </button>
                      )}
                    </div>
                  </div>
                  {!isDone && pendingItems.length > 0 && (
                    <span className="text-xs text-zinc-400">
                      חסר: {pendingItems.map((i) => i.label).join(', ')}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4">
        <span className="text-xs font-medium text-zinc-500">
          אופן חשיפת תוצאות: {VISIBILITY_LABELS[event.results_visibility]}
        </span>

        {event.results_visibility === 'manual' && (
          <>
            <button
              onClick={handleOpenResults}
              disabled={opening}
              className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {opening ? 'פותח…' : 'הצג תוצאות לכל הפריטים'}
            </button>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-500">פרסום נפרד לכל פריט</span>
              <ul className="flex flex-col gap-1.5">
                {itemsState.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2"
                  >
                    <span className="text-sm">{item.label}</span>
                    {item.results_open ? (
                      <span className="text-xs font-medium text-green-600">פורסם ✓</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenItemResults(item.id)}
                        disabled={openingItemId === item.id}
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 disabled:opacity-50"
                      >
                        {openingItemId === item.id ? 'מפרסם…' : 'פרסם'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {event.results_visibility !== 'manual' && (
          <p className="text-xs text-zinc-500">התוצאות ייחשפו אוטומטית לפי ההגדרה שבחרת, פריט אחר פריט</p>
        )}
      </div>
    </div>
  )
}
