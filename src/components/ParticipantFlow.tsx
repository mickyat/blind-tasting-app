'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getLastCategory, orderItemsByType } from '@/lib/results'
import type {
  CategoryRow,
  EventRow,
  ItemRow,
  ItemTypeRow,
  ParameterRow,
  ParticipantRow,
} from '@/lib/types'

interface Props {
  event: EventRow
  itemTypes: ItemTypeRow[]
  items: ItemRow[]
  categories: CategoryRow[]
  parameters: ParameterRow[]
}

function sessionKey(eventId: string) {
  return `bt_session_${eventId}`
}

function scoreKey(itemId: string, parameterId: string) {
  return `${itemId}:${parameterId}`
}

type TextSize = 'normal' | 'large' | 'xlarge'

const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  normal: 'רגיל',
  large: 'גדול',
  xlarge: 'גדול מאוד',
}

const TEXT_SIZE_STYLES: Record<TextSize, { heading: string; label: string; button: string }> = {
  normal: { heading: 'text-sm', label: 'text-sm', button: 'h-11 w-11 text-sm' },
  large: { heading: 'text-base', label: 'text-base', button: 'h-12 w-12 text-base' },
  xlarge: { heading: 'text-lg', label: 'text-lg', button: 'h-14 w-14 text-lg' },
}

const TEXT_SIZE_STORAGE_KEY = 'bt_text_size'

export default function ParticipantFlow({ event, itemTypes, items, categories, parameters }: Props) {
  const [supabase] = useState(() => createClient())
  const [checking, setChecking] = useState(true)
  const [participant, setParticipant] = useState<ParticipantRow | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, Set<string>>>({})
  const [activeItemId, setActiveItemId] = useState<string | undefined>(items[0]?.id)
  const [textSize, setTextSize] = useState<TextSize>('normal')
  const [itemResultsOpen, setItemResultsOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.results_open]))
  )
  const [finished, setFinished] = useState(false)
  const [reminder, setReminder] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(TEXT_SIZE_STORAGE_KEY)
    if (saved === 'normal' || saved === 'large' || saved === 'xlarge') setTextSize(saved)
  }, [])

  function changeTextSize(size: TextSize) {
    setTextSize(size)
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, size)
  }

  useEffect(() => {
    let cancelled = false
    async function restore() {
      const token = localStorage.getItem(sessionKey(event.id))
      if (!token) {
        setChecking(false)
        return
      }
      const { data: existing } = await supabase
        .from('participant')
        .select('*')
        .eq('event_id', event.id)
        .eq('session_token', token)
        .maybeSingle()

      if (cancelled) return

      if (!existing) {
        localStorage.removeItem(sessionKey(event.id))
        setChecking(false)
        return
      }

      setParticipant(existing)

      const [{ data: existingScores }, { data: existingChecklist }] = await Promise.all([
        supabase.from('score').select('item_id, parameter_id, value').eq('participant_id', existing.id),
        supabase
          .from('checklist_answer')
          .select('item_id, parameter_id, option')
          .eq('participant_id', existing.id),
      ])

      if (!cancelled && existingScores) {
        const map: Record<string, number> = {}
        for (const s of existingScores) {
          map[scoreKey(s.item_id, s.parameter_id)] = Number(s.value)
        }
        setScores(map)
      }
      if (!cancelled && existingChecklist) {
        const map: Record<string, Set<string>> = {}
        for (const a of existingChecklist) {
          const key = scoreKey(a.item_id, a.parameter_id)
          if (!map[key]) map[key] = new Set()
          map[key].add(a.option)
        }
        setChecklistAnswers(map)
      }
      setChecking(false)
    }
    restore()
    return () => {
      cancelled = true
    }
  }, [event.id, supabase])

  // Live-updates when the host publishes/locks a specific item.
  useEffect(() => {
    const channel = supabase
      .channel(`participant-items-${event.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'item' }, (payload) => {
        const updated = payload.new as { id: string; results_open?: boolean }
        setItemResultsOpen((prev) => ({ ...prev, [updated.id]: Boolean(updated.results_open) }))
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, event.id])

  // Host "send reminder" banner - ephemeral broadcast, only while connected.
  useEffect(() => {
    if (!participant) return
    const channel = supabase
      .channel(`participant-${participant.id}`)
      .on('broadcast', { event: 'reminder' }, () => setReminder(true))
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [participant, supabase])

  const orderedItems = useMemo(() => orderItemsByType(items, itemTypes), [items, itemTypes])

  const doneItemIds = useMemo(() => {
    const done = new Set<string>()
    for (const item of items) {
      const lastCategory = getLastCategory(item.item_type_id, categories)
      if (!lastCategory) continue
      const lastParams = parameters.filter((p) => p.category_id === lastCategory.id)
      if (lastParams.length === 0) continue
      const filled = lastParams.every((p) => {
        const key = scoreKey(item.id, p.id)
        return p.kind === 'scale' ? scores[key] !== undefined : (checklistAnswers[key]?.size ?? 0) > 0
      })
      if (filled) done.add(item.id)
    }
    return done
  }, [items, parameters, categories, scores, checklistAnswers])

  if (checking) {
    return <p className="text-center text-sm text-zinc-400">טוען…</p>
  }

  if (!participant) {
    return (
      <JoinForm
        event={event}
        supabase={supabase}
        onJoined={(p) => {
          localStorage.setItem(sessionKey(event.id), p.session_token)
          setParticipant(p)
        }}
      />
    )
  }

  async function setScore(itemId: string, parameterId: string, value: number) {
    setScores((prev) => ({ ...prev, [scoreKey(itemId, parameterId)]: value }))
    await supabase
      .from('score')
      .upsert(
        { participant_id: participant!.id, item_id: itemId, parameter_id: parameterId, value },
        { onConflict: 'participant_id,item_id,parameter_id' }
      )
  }

  async function toggleChecklistOption(
    itemId: string,
    parameterId: string,
    option: string,
    multiSelect: boolean
  ) {
    const key = scoreKey(itemId, parameterId)
    const current = checklistAnswers[key] ?? new Set<string>()
    const isSelected = current.has(option)

    if (multiSelect) {
      if (isSelected) {
        await supabase
          .from('checklist_answer')
          .delete()
          .match({ participant_id: participant!.id, item_id: itemId, parameter_id: parameterId, option })
        const next = new Set(current)
        next.delete(option)
        setChecklistAnswers((prev) => ({ ...prev, [key]: next }))
      } else {
        await supabase
          .from('checklist_answer')
          .insert({ participant_id: participant!.id, item_id: itemId, parameter_id: parameterId, option })
        const next = new Set(current)
        next.add(option)
        setChecklistAnswers((prev) => ({ ...prev, [key]: next }))
      }
    } else {
      await supabase
        .from('checklist_answer')
        .delete()
        .match({ participant_id: participant!.id, item_id: itemId, parameter_id: parameterId })
      if (isSelected) {
        setChecklistAnswers((prev) => ({ ...prev, [key]: new Set() }))
      } else {
        await supabase
          .from('checklist_answer')
          .insert({ participant_id: participant!.id, item_id: itemId, parameter_id: parameterId, option })
        setChecklistAnswers((prev) => ({ ...prev, [key]: new Set([option]) }))
      }
    }
  }

  function selectItem(itemId: string) {
    setActiveItemId(itemId)
    setFinished(false)
  }

  function handleFinishItem() {
    if (!activeItem) return
    const idx = orderedItems.findIndex((i) => i.id === activeItem.id)
    if (idx === -1) return
    if (idx === orderedItems.length - 1) {
      setFinished(true)
    } else {
      selectItem(orderedItems[idx + 1].id)
    }
  }

  const activeItem = items.find((i) => i.id === activeItemId) ?? items[0]
  const activeItemLocked = activeItem ? itemResultsOpen[activeItem.id] === true : false
  const activeItemDone = activeItem ? doneItemIds.has(activeItem.id) : false
  const activeItemLastCategory = activeItem ? getLastCategory(activeItem.item_type_id, categories) : null
  const isLastItem = activeItem
    ? orderedItems.findIndex((i) => i.id === activeItem.id) === orderedItems.length - 1
    : false

  function renderItemTab(item: ItemRow) {
    return (
      <button
        key={item.id}
        onClick={() => selectItem(item.id)}
        className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${
          activeItem?.id === item.id
            ? 'border-zinc-900 bg-zinc-900 text-white'
            : 'border-zinc-300 bg-white text-zinc-700'
        }`}
      >
        {item.label} {doneItemIds.has(item.id) ? '✓' : ''}
        {itemResultsOpen[item.id] && ' 🔒'}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {reminder && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>המארגן מבקש שתסיים למלא 🙂</span>
          <button
            type="button"
            onClick={() => setReminder(false)}
            className="shrink-0 text-xs font-medium underline"
          >
            סגור
          </button>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm">
        <span>
          שלום, <strong>{participant.nickname}</strong>
        </span>
        <span className="text-xs text-zinc-500">
          {doneItemIds.size}/{items.length} פריטים הושלמו
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-white px-4 py-2">
        <span className="text-xs text-zinc-500">גודל טקסט:</span>
        {(Object.keys(TEXT_SIZE_LABELS) as TextSize[]).map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => changeTextSize(size)}
            className={`rounded-lg border px-2 py-1 text-xs font-medium ${
              textSize === size
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-300 bg-white text-zinc-700'
            }`}
          >
            {TEXT_SIZE_LABELS[size]}
          </button>
        ))}
      </div>

      {itemTypes.length > 1 ? (
        <div className="flex flex-col gap-3">
          {itemTypes.map((t) => (
            <div key={t.id} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">{t.name}</span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {items.filter((i) => i.item_type_id === t.id).map(renderItemTab)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">{items.map(renderItemTab)}</div>
      )}

      {finished ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-300 bg-white p-6 text-center">
          <span className="text-2xl">🎉</span>
          <p className="text-base font-semibold text-zinc-800">סיימת לדרג את כל הפריטים!</p>
          <p className="text-sm text-zinc-500">
            עדיין אפשר לחזור ולערוך כל פריט מהרשימה למעלה, כל עוד התוצאות שלו לא פורסמו
          </p>
        </div>
      ) : (
        activeItem && (
          <div className="flex flex-col gap-6">
            {activeItemLocked && (
              <div className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-center text-sm text-zinc-600">
                🔒 התוצאות לפריט הזה כבר פורסמו, אי אפשר לערוך יותר
              </div>
            )}
            {categories
              .filter((c) => c.item_type_id === activeItem.item_type_id)
              .map((category) => {
                const categoryParams = parameters.filter((p) => p.category_id === category.id)
                if (categoryParams.length === 0) return null
                const isLastCategory = category.id === activeItemLastCategory?.id
                return (
                  <div key={category.id} className="flex flex-col gap-3">
                    <h3 className={`font-semibold text-zinc-800 ${TEXT_SIZE_STYLES[textSize].heading}`}>
                      {category.name}
                      {isLastCategory && (
                        <span className="mr-2 text-xs font-normal text-amber-600">(חובה)</span>
                      )}
                    </h3>
                    <div className="flex flex-col gap-3">
                      {categoryParams.map((param) => {
                        const key = scoreKey(activeItem.id, param.id)
                        if (param.kind === 'scale') {
                          const current = scores[key]
                          const options = Array.from(
                            { length: (param.scale_max ?? 5) - (param.scale_min ?? 1) + 1 },
                            (_, i) => (param.scale_min ?? 1) + i
                          )
                          return (
                            <div
                              key={param.id}
                              className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-4"
                            >
                              <span className={`font-medium text-zinc-700 ${TEXT_SIZE_STYLES[textSize].label}`}>
                                {param.name}
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {options.map((opt) => (
                                  <button
                                    key={opt}
                                    disabled={activeItemLocked}
                                    onClick={() => setScore(activeItem.id, param.id, opt)}
                                    className={`flex items-center justify-center rounded-full border font-semibold disabled:opacity-50 ${TEXT_SIZE_STYLES[textSize].button} ${
                                      current === opt
                                        ? 'border-zinc-900 bg-zinc-900 text-white'
                                        : 'border-zinc-300 bg-white text-zinc-700'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        }

                        const selected = checklistAnswers[key] ?? new Set<string>()
                        return (
                          <div
                            key={param.id}
                            className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-4"
                          >
                            <span className={`font-medium text-zinc-700 ${TEXT_SIZE_STYLES[textSize].label}`}>
                              {param.name}
                              {param.multi_select && (
                                <span className="mr-2 text-xs font-normal text-zinc-400">(בחירה מרובה)</span>
                              )}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {(param.options ?? []).map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  disabled={activeItemLocked}
                                  onClick={() => toggleChecklistOption(activeItem.id, param.id, opt, param.multi_select)}
                                  className={`rounded-full border px-3 py-2 font-medium disabled:opacity-50 ${TEXT_SIZE_STYLES[textSize].label} ${
                                    selected.has(opt)
                                      ? 'border-zinc-900 bg-zinc-900 text-white'
                                      : 'border-zinc-300 bg-white text-zinc-700'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

            {!activeItemLocked && (
              <div className="flex flex-col gap-2">
                {!activeItemDone && (
                  <p className="text-center text-xs text-zinc-500">
                    יש למלא את הקטגוריה &quot;{activeItemLastCategory?.name}&quot; כדי להמשיך
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleFinishItem}
                  disabled={!activeItemDone}
                  className="rounded-xl bg-zinc-900 px-4 py-4 text-base font-semibold text-white disabled:opacity-40"
                >
                  {isLastItem ? 'סיימתי לדרג' : 'סיימתי - לפריט הבא'}
                </button>
              </div>
            )}
          </div>
        )
      )}

      <Link
        href={`/e/${event.share_token}/results`}
        className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-700"
      >
        למסך התוצאות
      </Link>

      <Link href="/" className="text-center text-xs text-zinc-400 underline">
        את/ה המארגן/ת של האירוע? חזרה לדף הבית
      </Link>
    </div>
  )
}

function JoinForm({
  event,
  supabase,
  onJoined,
}: {
  event: EventRow
  supabase: ReturnType<typeof createClient>
  onJoined: (p: ParticipantRow) => void
}) {
  const [nickname, setNickname] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = nickname.trim()
    if (!trimmed) return
    setPending(true)
    setError(null)
    const { data, error: insertError } = await supabase
      .from('participant')
      .insert({ event_id: event.id, nickname: trimmed })
      .select()
      .single()
    setPending(false)
    if (insertError || !data) {
      setError('שגיאה בהצטרפות, נסה שוב')
      return
    }
    onJoined(data)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label htmlFor="nickname" className="text-sm font-medium text-zinc-700">
        איך קוראים לך?
      </label>
      <input
        id="nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="שם או כינוי"
        className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base focus:border-zinc-500 focus:outline-none"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-zinc-900 px-4 py-4 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'מצטרף…' : 'הצטרף להטעימה'}
      </button>
      <Link href="/" className="text-center text-xs text-zinc-400 underline">
        את/ה המארגן/ת של האירוע? חזרה לדף הבית
      </Link>
    </form>
  )
}
