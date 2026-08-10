'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createEvent } from '@/app/actions'
import type { ResultsVisibility } from '@/lib/types'

interface ParameterDraft {
  name: string
  weight: number
  scaleMin: number
  scaleMax: number
}

const VISIBILITY_OPTIONS: { value: ResultsVisibility; label: string; hint: string }[] = [
  { value: 'manual', label: 'ידני', hint: 'התוצאות ייחשפו רק כשתלחץ על "הצג תוצאות"' },
  { value: 'after_all_done', label: 'אחרי שכולם סיימו', hint: 'התוצאות ייחשפו אוטומטית כשכל המשתתפים דירגו הכול' },
  { value: 'live', label: 'חי', hint: 'התוצאות מוצגות ומתעדכנות מהניקוד הראשון' },
]

export default function CreateEventForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [items, setItems] = useState(['', ''])
  const [parameters, setParameters] = useState<ParameterDraft[]>([
    { name: '', weight: 5, scaleMin: 1, scaleMax: 5 },
  ])
  const [visibility, setVisibility] = useState<ResultsVisibility>('manual')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function updateItem(i: number, value: string) {
    setItems((prev) => prev.map((v, idx) => (idx === i ? value : v)))
  }
  function addItem() {
    setItems((prev) => [...prev, ''])
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateParameter(i: number, patch: Partial<ParameterDraft>) {
    setParameters((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }
  function addParameter() {
    setParameters((prev) => [...prev, { name: '', weight: 5, scaleMin: 1, scaleMax: 5 }])
  }
  function removeParameter(i: number) {
    setParameters((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createEvent({
        title,
        resultsVisibility: visibility,
        items,
        parameters,
      })
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      if (!('hostToken' in result) || !result.hostToken) {
        setError('שגיאה לא צפויה, נסה שוב')
        return
      }
      router.push(`/host/${result.hostToken}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <label htmlFor="title" className="text-sm font-medium text-zinc-700">
          כותרת האירוע
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="למשל: הטעימת יינות אדומים"
          className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base focus:border-zinc-500 focus:outline-none"
          required
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700">פריטים להטעימה</h2>
        <div className="flex flex-col gap-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
                placeholder={`פריט ${i + 1} (למשל: יין מספר ${i + 1})`}
                className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base focus:border-zinc-500 focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                disabled={items.length <= 2}
                aria-label="הסר פריט"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-300 text-zinc-500 disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="self-start rounded-xl border border-dashed border-zinc-400 px-4 py-2 text-sm font-medium text-zinc-600"
        >
          + הוסף פריט
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700">פרמטרים לניקוד</h2>
        <div className="flex flex-col gap-4">
          {parameters.map((p, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-4">
              <div className="flex items-center gap-2">
                <input
                  value={p.name}
                  onChange={(e) => updateParameter(i, { name: e.target.value })}
                  placeholder={`פרמטר ${i + 1} (למשל: עסיסיות)`}
                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base focus:border-zinc-500 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => removeParameter(i)}
                  disabled={parameters.length <= 1}
                  aria-label="הסר פרמטר"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 text-zinc-500 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  משקל
                  <input
                    type="number"
                    min={0.1}
                    step={0.5}
                    value={p.weight}
                    onChange={(e) => updateParameter(i, { weight: Number(e.target.value) })}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-base focus:border-zinc-500 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  סולם מ-
                  <input
                    type="number"
                    value={p.scaleMin}
                    onChange={(e) => updateParameter(i, { scaleMin: Number(e.target.value) })}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-base focus:border-zinc-500 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  סולם עד
                  <input
                    type="number"
                    value={p.scaleMax}
                    onChange={(e) => updateParameter(i, { scaleMax: Number(e.target.value) })}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-base focus:border-zinc-500 focus:outline-none"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addParameter}
          className="self-start rounded-xl border border-dashed border-zinc-400 px-4 py-2 text-sm font-medium text-zinc-600"
        >
          + הוסף פרמטר
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700">מתי להציג תוצאות</h2>
        <div className="flex flex-col gap-2">
          {VISIBILITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 ${
                visibility === opt.value ? 'border-zinc-800 bg-zinc-100' : 'border-zinc-300 bg-white'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === opt.value}
                  onChange={() => setVisibility(opt.value)}
                />
                {opt.label}
              </span>
              <span className="text-xs text-zinc-500">{opt.hint}</span>
            </label>
          ))}
        </div>
      </section>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-zinc-900 px-4 py-4 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'יוצר אירוע…' : 'צור אירוע'}
      </button>
    </form>
  )
}
