'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  openResults,
  openItemResults,
  updateExternalValue,
  uploadItemPhoto,
  removeItemPhoto,
  updateItemLabel,
} from '@/app/actions'
import { buildAnsweredSet, isItemDone } from '@/lib/results'
import { PRIMARY_BUTTON_CLASS } from '@/lib/ui'
import type {
  CategoryRow,
  ChecklistAnswerRow,
  EventRow,
  ExternalCriterionRow,
  ItemExternalValueRow,
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
  externalCriteria: ExternalCriterionRow[]
  externalValues: ItemExternalValueRow[]
}

const VISIBILITY_LABELS: Record<string, string> = {
  manual: 'ידני',
  after_all_done: 'אחרי שכולם סיימו',
  live: 'חי',
}

export default function HostDashboard({
  hostToken,
  event,
  items,
  categories,
  parameters,
  externalCriteria,
  externalValues,
}: Props) {
  const [supabase] = useState(() => createClient())
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [checklistAnswers, setChecklistAnswers] = useState<ChecklistAnswerRow[]>([])
  const [itemsState, setItemsState] = useState<ItemRow[]>(items)
  const [opening, setOpening] = useState(false)
  const [openingItemId, setOpeningItemId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [reminded, setReminded] = useState<Record<string, boolean>>({})

  const [externalValueState, setExternalValueState] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const v of externalValues) {
      if (v.raw_value !== null) init[`${v.item_id}:${v.criterion_id}`] = v.raw_value
    }
    return init
  })
  const [externalSaving, setExternalSaving] = useState<Record<string, boolean>>({})
  const [externalSaved, setExternalSaved] = useState<Record<string, boolean>>({})

  async function saveExternalValue(itemId: string, criterionId: string, value: string) {
    const key = `${itemId}:${criterionId}`
    setExternalValueState((prev) => ({ ...prev, [key]: value }))
    setExternalSaving((prev) => ({ ...prev, [key]: true }))
    const result = await updateExternalValue(hostToken, itemId, criterionId, value)
    setExternalSaving((prev) => ({ ...prev, [key]: false }))
    if ('ok' in result) {
      setExternalSaved((prev) => ({ ...prev, [key]: true }))
      setTimeout(() => setExternalSaved((prev) => ({ ...prev, [key]: false })), 1500)
    }
  }

  const [labelState, setLabelState] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.custom_label ?? '']))
  )
  const [labelSaving, setLabelSaving] = useState<Record<string, boolean>>({})
  const [photoUploading, setPhotoUploading] = useState<Record<string, boolean>>({})
  const [photoError, setPhotoError] = useState<Record<string, string>>({})

  async function saveLabel(itemId: string, value: string) {
    setLabelSaving((prev) => ({ ...prev, [itemId]: true }))
    await updateItemLabel(hostToken, itemId, value)
    setLabelSaving((prev) => ({ ...prev, [itemId]: false }))
  }

  async function handlePhotoChange(itemId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError((prev) => ({ ...prev, [itemId]: '' }))
    setPhotoUploading((prev) => ({ ...prev, [itemId]: true }))
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadItemPhoto(hostToken, itemId, fd)
    setPhotoUploading((prev) => ({ ...prev, [itemId]: false }))
    if ('error' in result && result.error) {
      setPhotoError((prev) => ({ ...prev, [itemId]: result.error as string }))
      return
    }
    if ('url' in result && result.url) {
      setItemsState((prev) => prev.map((i) => (i.id === itemId ? { ...i, image_url: result.url as string } : i)))
    }
  }

  async function handleRemovePhoto(itemId: string) {
    setPhotoUploading((prev) => ({ ...prev, [itemId]: true }))
    const result = await removeItemPhoto(hostToken, itemId)
    setPhotoUploading((prev) => ({ ...prev, [itemId]: false }))
    if ('ok' in result) {
      setItemsState((prev) => prev.map((i) => (i.id === itemId ? { ...i, image_url: null } : i)))
    }
  }

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
        <a
          href={`/e/${event.share_token}/results`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-center text-xs font-semibold text-zinc-700"
        >
          מעבר למסך התוצאות ←
        </a>
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
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isDone ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {isDone ? '✓ סיים' : `⏳ ${doneItems.length}/${itemsState.length}`}
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

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700">תמונה/תיאור לכל פריט (מוצג בתוצאות במקום &quot;פריט מספר X&quot;)</h2>
        {itemsState.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-3">
            <span className="text-sm font-medium text-zinc-800">{item.label}</span>
            <div className="flex items-center gap-3">
              {item.image_url ? (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image_url}
                    alt=""
                    className="h-14 w-14 rounded-lg border border-zinc-300 object-cover bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(item.id)}
                    disabled={photoUploading[item.id]}
                    className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-600 disabled:opacity-50"
                  >
                    הסר תמונה
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  capture="environment"
                  onChange={(e) => handlePhotoChange(item.id, e)}
                  disabled={photoUploading[item.id]}
                  className="text-xs text-zinc-600"
                />
              )}
              {photoUploading[item.id] && <span className="text-xs text-zinc-400">מעלה…</span>}
            </div>
            {photoError[item.id] && <p className="text-xs text-red-600">{photoError[item.id]}</p>}
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                תיאור חופשי (למשל: יין X, 120 ש&quot;ח)
                {labelSaving[item.id] && <span className="text-zinc-400">שומר…</span>}
              </span>
              <input
                value={labelState[item.id] ?? ''}
                onChange={(e) => setLabelState((prev) => ({ ...prev, [item.id]: e.target.value }))}
                onBlur={(e) => saveLabel(item.id, e.target.value)}
                className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        ))}
      </div>

      {externalCriteria.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-700">קריטריונים חיצוניים</h2>
          {itemsState.map((item) => {
            const itemCriteria = externalCriteria.filter((c) => c.item_type_id === item.item_type_id)
            if (itemCriteria.length === 0) return null
            return (
              <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-3">
                <span className="text-sm font-medium text-zinc-800">{item.label}</span>
                <div className="flex flex-wrap gap-2">
                  {itemCriteria.map((crit) => {
                    const key = `${item.id}:${crit.id}`
                    const value = externalValueState[key] ?? ''
                    return (
                      <label key={crit.id} className="flex min-w-[110px] flex-1 flex-col gap-1 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          {crit.name}
                          {externalSaving[key] && <span className="text-zinc-400">שומר…</span>}
                          {externalSaved[key] && <span className="text-green-600">נשמר ✓</span>}
                        </span>
                        {crit.calc_type === 'options' ? (
                          <select
                            value={value}
                            onChange={(e) => saveExternalValue(item.id, crit.id, e.target.value)}
                            className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                          >
                            <option value="">—</option>
                            {(crit.config?.options ?? []).map((opt, oi) => (
                              <option key={oi} value={opt.label}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="number"
                            step="any"
                            value={value}
                            onChange={(e) =>
                              setExternalValueState((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            onBlur={(e) => saveExternalValue(item.id, crit.id, e.target.value)}
                            className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                          />
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4">
        <span className="text-xs font-medium text-zinc-500">
          אופן חשיפת תוצאות: {VISIBILITY_LABELS[event.results_visibility]}
        </span>

        {event.results_visibility === 'manual' && (
          <>
            <button onClick={handleOpenResults} disabled={opening} className={PRIMARY_BUTTON_CLASS}>
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
