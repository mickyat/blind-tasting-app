'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createEvent, uploadEventLogo } from '@/app/actions'
import type { EventTheme, ResultsVisibility } from '@/lib/types'
import { THEME_STYLES } from '@/lib/theme'
import { EVENT_TEMPLATES } from '@/lib/templates'

interface ParameterDraft {
  name: string
  weight: number
  scaleMin: number
  scaleMax: number
}

interface CategoryDraft {
  name: string
  weight: number
  parameters: ParameterDraft[]
}

function emptyParameter(): ParameterDraft {
  return { name: '', weight: 5, scaleMin: 1, scaleMax: 5 }
}

function emptyCategory(): CategoryDraft {
  return { name: '', weight: 5, parameters: [emptyParameter()] }
}

const VISIBILITY_OPTIONS: { value: ResultsVisibility; label: string; hint: string }[] = [
  { value: 'manual', label: 'ידני', hint: 'התוצאות ייחשפו רק כשתלחץ על "הצג תוצאות"' },
  { value: 'after_all_done', label: 'אחרי שכולם סיימו', hint: 'התוצאות ייחשפו אוטומטית כשכל המשתתפים דירגו הכול' },
  { value: 'live', label: 'חי', hint: 'התוצאות מוצגות ומתעדכנות מהניקוד הראשון' },
]

export default function CreateEventForm() {
  const router = useRouter()
  const [step, setStep] = useState<'template' | 'form'>('template')
  const [theme, setTheme] = useState<EventTheme>('default')
  const [title, setTitle] = useState('')
  const [items, setItems] = useState(['', ''])
  const [categories, setCategories] = useState<CategoryDraft[]>([emptyCategory()])
  const [visibility, setVisibility] = useState<ResultsVisibility>('manual')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function chooseTemplate(templateId: EventTheme) {
    const template = EVENT_TEMPLATES.find((t) => t.id === templateId)
    if (template) {
      setCategories(
        template.categories.map((c) => ({
          name: c.name,
          weight: c.weight,
          parameters: c.parameters.map((p) => ({ ...p })),
        }))
      )
      setTheme(template.id)
    }
    setStep('form')
  }

  function startFromScratch() {
    setCategories([emptyCategory()])
    setTheme('default')
    setStep('form')
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError(null)
    setLogoUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadEventLogo(fd)
    setLogoUploading(false)
    if ('error' in result && result.error) {
      setLogoError(result.error)
      return
    }
    if (!('url' in result) || !result.url) {
      setLogoError('שגיאה לא צפויה, נסה שוב')
      return
    }
    setLogoUrl(result.url)
  }

  function updateItem(i: number, value: string) {
    setItems((prev) => prev.map((v, idx) => (idx === i ? value : v)))
  }
  function addItem() {
    setItems((prev) => [...prev, ''])
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateCategory(ci: number, patch: Partial<CategoryDraft>) {
    setCategories((prev) => prev.map((c, idx) => (idx === ci ? { ...c, ...patch } : c)))
  }
  function addCategory() {
    setCategories((prev) => [...prev, emptyCategory()])
  }
  function removeCategory(ci: number) {
    setCategories((prev) => prev.filter((_, idx) => idx !== ci))
  }

  function updateParameter(ci: number, pi: number, patch: Partial<ParameterDraft>) {
    setCategories((prev) =>
      prev.map((c, idx) =>
        idx === ci
          ? { ...c, parameters: c.parameters.map((p, j) => (j === pi ? { ...p, ...patch } : p)) }
          : c
      )
    )
  }
  function addParameter(ci: number) {
    setCategories((prev) =>
      prev.map((c, idx) => (idx === ci ? { ...c, parameters: [...c.parameters, emptyParameter()] } : c))
    )
  }
  function removeParameter(ci: number, pi: number) {
    setCategories((prev) =>
      prev.map((c, idx) =>
        idx === ci ? { ...c, parameters: c.parameters.filter((_, j) => j !== pi) } : c
      )
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createEvent({
        title,
        resultsVisibility: visibility,
        items,
        categories,
        theme,
        logoUrl,
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

  if (step === 'template') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-zinc-500">איך תרצה להתחיל?</p>
        <div className="grid grid-cols-2 gap-3">
          {EVENT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => chooseTemplate(t.id)}
              className={`flex flex-col items-center gap-1 rounded-xl border border-zinc-300 p-4 text-center font-medium ${THEME_STYLES[t.id].bg}`}
            >
              <span className={`text-base font-semibold ${THEME_STYLES[t.id].accent}`}>{t.label}</span>
              <span className="text-xs font-normal text-zinc-500">תבנית מוכנה</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={startFromScratch}
          className="rounded-xl border border-dashed border-zinc-400 px-4 py-3 text-sm font-medium text-zinc-600"
        >
          התחל מאפס
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex flex-col gap-8 rounded-2xl p-4 -mx-4 ${THEME_STYLES[theme].bg}`}
    >
      <button
        type="button"
        onClick={() => setStep('template')}
        className="self-start text-xs font-medium text-zinc-500 underline"
      >
        ← חזרה לבחירת תבנית
      </button>

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

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-zinc-700">לוגו (אופציונלי)</h2>
        {logoUrl ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="לוגו" className="h-14 w-14 rounded-lg border border-zinc-300 object-contain bg-white" />
            <button
              type="button"
              onClick={() => setLogoUrl(null)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600"
            >
              הסר לוגו
            </button>
          </div>
        ) : (
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleLogoChange}
            disabled={logoUploading}
            className="text-sm text-zinc-600"
          />
        )}
        {logoUploading && <p className="text-xs text-zinc-500">מעלה…</p>}
        {logoError && <p className="text-xs text-red-600">{logoError}</p>}
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
                className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base focus:border-zinc-500 focus:outline-none"
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
        <h2 className="text-sm font-medium text-zinc-700">קטגוריות ותת-שאלות</h2>
        <div className="flex flex-col gap-4">
          {categories.map((category, ci) => (
            <div key={ci} className="flex flex-col gap-3 rounded-xl border border-zinc-400 bg-white p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    value={category.name}
                    onChange={(e) => updateCategory(ci, { name: e.target.value })}
                    placeholder={`קטגוריה ${ci + 1} (למשל: אף)`}
                    className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base font-medium focus:border-zinc-500 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => removeCategory(ci)}
                    disabled={categories.length <= 1}
                    aria-label="הסר קטגוריה"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 text-zinc-500 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  משקל קטגוריה
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={category.weight}
                    onChange={(e) => updateCategory(ci, { weight: Number(e.target.value) })}
                    className="w-20 shrink-0 rounded-lg border border-zinc-300 px-2 py-2 text-base focus:border-zinc-500 focus:outline-none"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-2 border-r-2 border-zinc-200 pr-3">
                {category.parameters.map((p, pi) => (
                  <div key={pi} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={p.name}
                        onChange={(e) => updateParameter(ci, pi, { name: e.target.value })}
                        placeholder={`תת-שאלה ${pi + 1} (למשל: עוצמה)`}
                        className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base focus:border-zinc-500 focus:outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => removeParameter(ci, pi)}
                        disabled={category.parameters.length <= 1}
                        aria-label="הסר תת-שאלה"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 text-zinc-500 disabled:opacity-30"
                      >
                        ✕
                      </button>
                    </div>
                    <label className="flex flex-col gap-1 text-xs text-zinc-500">
                      משקל
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={p.weight}
                        onChange={(e) => updateParameter(ci, pi, { weight: Number(e.target.value) })}
                        className="w-full min-w-0 rounded-lg border border-zinc-300 px-2 py-2 text-base focus:border-zinc-500 focus:outline-none"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-500">
                        סולם מ-
                        <input
                          type="number"
                          value={p.scaleMin}
                          onChange={(e) => updateParameter(ci, pi, { scaleMin: Number(e.target.value) })}
                          className="w-full min-w-0 rounded-lg border border-zinc-300 px-2 py-2 text-base focus:border-zinc-500 focus:outline-none"
                        />
                      </label>
                      <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-500">
                        סולם עד
                        <input
                          type="number"
                          value={p.scaleMax}
                          onChange={(e) => updateParameter(ci, pi, { scaleMax: Number(e.target.value) })}
                          className="w-full min-w-0 rounded-lg border border-zinc-300 px-2 py-2 text-base focus:border-zinc-500 focus:outline-none"
                        />
                      </label>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addParameter(ci)}
                  className="self-start rounded-lg border border-dashed border-zinc-400 px-3 py-1.5 text-xs font-medium text-zinc-600"
                >
                  + הוסף תת-שאלה
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addCategory}
          className="self-start rounded-xl border border-dashed border-zinc-400 px-4 py-2 text-sm font-medium text-zinc-600"
        >
          + הוסף קטגוריה
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
