'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildAnsweredSet, calculateResults, isItemDone, rankResults, type ItemResult } from '@/lib/results'
import type {
  CategoryRow,
  ChecklistAnswerRow,
  EventRow,
  ItemRow,
  ItemTypeRow,
  ParameterRow,
  ParticipantRow,
  ScoreRow,
} from '@/lib/types'

interface Props {
  event: EventRow
  itemTypes: ItemTypeRow[]
  items: ItemRow[]
  categories: CategoryRow[]
  parameters: ParameterRow[]
}

export default function ResultsView({ event, itemTypes, items, categories, parameters }: Props) {
  const [supabase] = useState(() => createClient())
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [checklistAnswers, setChecklistAnswers] = useState<ChecklistAnswerRow[]>([])
  const [itemsState, setItemsState] = useState<ItemRow[]>(items)

  const refresh = useCallback(async () => {
    const { data: parts } = await supabase.from('participant').select('*').eq('event_id', event.id)
    setParticipants(parts ?? [])

    const itemIds = items.map((i) => i.id)
    if (itemIds.length > 0) {
      const [{ data: sc }, { data: ca }] = await Promise.all([
        supabase.from('score').select('*').in('item_id', itemIds),
        supabase.from('checklist_answer').select('*').in('item_id', itemIds),
      ])
      setScores(sc ?? [])
      setChecklistAnswers(ca ?? [])
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

  const isItemOpen = useCallback(
    (item: ItemRow) => {
      if (event.results_visibility === 'live') return true
      if (event.results_visibility === 'after_all_done') {
        return participants.length > 0 && participants.every((p) => isItemDone(p.id, item, categories, parameters, answered))
      }
      return item.results_open
    },
    [event.results_visibility, participants, categories, parameters, answered]
  )

  const openItems = itemsState.filter(isItemOpen)
  const pendingItems = itemsState.filter((i) => !isItemOpen(i))

  if (openItems.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
        {event.results_visibility === 'after_all_done' ? (
          <p className="text-base font-medium text-zinc-700">מחכים שמשתתפים יסיימו לדרג פריטים</p>
        ) : (
          <p className="text-base font-medium text-zinc-700">מחכים שהמארגן יפתח את התוצאות</p>
        )}
      </div>
    )
  }

  const overallRanked = rankResults(calculateResults(openItems, categories, parameters, scores))
  const hasMultipleTypes = itemTypes.length > 1

  return (
    <div className="flex flex-col gap-8">
      <RankingList title={hasMultipleTypes ? 'דירוג כללי' : undefined} results={overallRanked} />

      {hasMultipleTypes &&
        itemTypes.map((t) => {
          const typeItems = openItems.filter((i) => i.item_type_id === t.id)
          if (typeItems.length === 0) return null
          const typeRanked = rankResults(calculateResults(typeItems, categories, parameters, scores))
          return <RankingList key={t.id} title={`דירוג ${t.name}`} results={typeRanked} />
        })}

      {pendingItems.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-zinc-300 p-4">
          <span className="text-xs font-medium text-zinc-500">טרם פורסמו</span>
          <span className="text-sm text-zinc-600">{pendingItems.map((i) => i.label).join(', ')}</span>
        </div>
      )}

      <DescriptiveSummary
        items={openItems}
        categories={categories}
        parameters={parameters}
        checklistAnswers={checklistAnswers}
        participantCount={participants.length}
      />
    </div>
  )
}

function RankingList({ title, results }: { title?: string; results: ItemResult[] }) {
  return (
    <div className="flex flex-col gap-3">
      {title && <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>}
      {results.map((r, i) => (
        <div
          key={r.item.id}
          className={`flex items-center justify-between rounded-xl border p-4 ${
            i === 0 ? 'border-amber-400 bg-amber-50' : 'border-zinc-300 bg-white'
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

function DescriptiveSummary({
  items,
  categories,
  parameters,
  checklistAnswers,
  participantCount,
}: {
  items: ItemRow[]
  categories: CategoryRow[]
  parameters: ParameterRow[]
  checklistAnswers: ChecklistAnswerRow[]
  participantCount: number
}) {
  const checklistParams = parameters.filter((p) => p.kind === 'checklist')
  if (checklistParams.length === 0 || participantCount === 0) return null

  const categoryById = new Map(categories.map((c) => [c.id, c]))

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-zinc-700">סיכום תיאורי טעימה</h2>
      {items.map((item) => {
        const itemParams = checklistParams.filter(
          (p) => categoryById.get(p.category_id)?.item_type_id === item.item_type_id
        )
        if (itemParams.length === 0) return null

        return (
          <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-800">{item.label}</h3>
            {itemParams.map((param) => {
              const counts = new Map<string, number>()
              for (const opt of param.options ?? []) counts.set(opt, 0)
              for (const a of checklistAnswers) {
                if (a.parameter_id !== param.id || a.item_id !== item.id) continue
                counts.set(a.option, (counts.get(a.option) ?? 0) + 1)
              }
              return (
                <div key={param.id} className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-zinc-500">{param.name}</span>
                  <ul className="flex flex-col gap-0.5">
                    {[...counts.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([option, count]) => (
                        <li key={option} className="flex items-center justify-between text-sm">
                          <span className="text-zinc-700">{option}</span>
                          <span className="text-zinc-500">
                            נבחר ע"י {count} מתוך {participantCount}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
