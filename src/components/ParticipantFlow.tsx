'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { CategoryRow, EventRow, ItemRow, ParameterRow, ParticipantRow } from '@/lib/types'

interface Props {
  event: EventRow
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

export default function ParticipantFlow({ event, items, categories, parameters }: Props) {
  const [supabase] = useState(() => createClient())
  const [checking, setChecking] = useState(true)
  const [participant, setParticipant] = useState<ParticipantRow | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [activeItemId, setActiveItemId] = useState<string | undefined>(items[0]?.id)

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

      const { data: existingScores } = await supabase
        .from('score')
        .select('item_id, parameter_id, value')
        .eq('participant_id', existing.id)

      if (!cancelled && existingScores) {
        const map: Record<string, number> = {}
        for (const s of existingScores) {
          map[scoreKey(s.item_id, s.parameter_id)] = Number(s.value)
        }
        setScores(map)
      }
      setChecking(false)
    }
    restore()
    return () => {
      cancelled = true
    }
  }, [event.id, supabase])

  const requiredPerItem = parameters.length
  const doneItemIds = useMemo(() => {
    const done = new Set<string>()
    for (const item of items) {
      const filled = parameters.every((p) => scores[scoreKey(item.id, p.id)] !== undefined)
      if (filled && requiredPerItem > 0) done.add(item.id)
    }
    return done
  }, [items, parameters, scores, requiredPerItem])

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

  const activeItem = items.find((i) => i.id === activeItemId) ?? items[0]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm">
        <span>
          שלום, <strong>{participant.nickname}</strong>
        </span>
        <span className="text-xs text-zinc-500">
          {doneItemIds.size}/{items.length} פריטים הושלמו
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveItemId(item.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${
              activeItem?.id === item.id
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-300 bg-white text-zinc-700'
            }`}
          >
            {item.label} {doneItemIds.has(item.id) ? '✓' : ''}
          </button>
        ))}
      </div>

      {activeItem && (
        <div className="flex flex-col gap-6">
          {categories.map((category) => {
            const categoryParams = parameters.filter((p) => p.category_id === category.id)
            if (categoryParams.length === 0) return null
            return (
              <div key={category.id} className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-zinc-800">{category.name}</h3>
                <div className="flex flex-col gap-3">
                  {categoryParams.map((param) => {
                    const current = scores[scoreKey(activeItem.id, param.id)]
                    const options = Array.from(
                      { length: param.scale_max - param.scale_min + 1 },
                      (_, i) => param.scale_min + i
                    )
                    return (
                      <div
                        key={param.id}
                        className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-4"
                      >
                        <span className="text-sm font-medium text-zinc-700">{param.name}</span>
                        <div className="flex flex-wrap gap-2">
                          {options.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => setScore(activeItem.id, param.id, opt)}
                              className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm font-semibold ${
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
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Link
        href={`/e/${event.share_token}/results`}
        className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-700"
      >
        למסך התוצאות
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
    </form>
  )
}
