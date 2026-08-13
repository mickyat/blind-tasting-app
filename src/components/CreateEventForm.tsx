'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createEvent, uploadEventLogo } from '@/app/actions'
import type { EventTheme, ExternalCriterionCalcType, ParameterKind, ResultsVisibility } from '@/lib/types'
import { THEME_STYLES } from '@/lib/theme'
import { EVENT_TEMPLATES, type EventTemplate } from '@/lib/templates'
import { saveMyEvent } from '@/components/MyEvents'

interface ParameterDraft {
  name: string
  weight: number
  kind: ParameterKind
  scaleMin: number
  scaleMax: number
  options: string[]
  multiSelect: boolean
}

interface CategoryDraft {
  name: string
  weight: number
  parameters: ParameterDraft[]
}

interface ThresholdDraft {
  max: number
  score: number
}

interface OptionRuleDraft {
  label: string
  score: number
}

interface ExternalCriterionDraft {
  name: string
  weight: number
  calcType: ExternalCriterionCalcType
  thresholds: ThresholdDraft[]
  defaultScore: number
  options: OptionRuleDraft[]
}

interface ItemDraft {
  label: string
  externalValues: Record<number, string>
}

interface ItemTypeDraft {
  name: string
  template: string | null
  items: ItemDraft[]
  categories: CategoryDraft[]
  externalCriteria: ExternalCriterionDraft[]
}

function emptyParameter(): ParameterDraft {
  return { name: '', weight: 5, kind: 'scale', scaleMin: 1, scaleMax: 5, options: [], multiSelect: false }
}

function emptyCategory(): CategoryDraft {
  return { name: '', weight: 5, parameters: [emptyParameter()] }
}

function emptyItem(): ItemDraft {
  return { label: '', externalValues: {} }
}

function emptyExternalCriterion(): ExternalCriterionDraft {
  return {
    name: '',
    weight: 5,
    calcType: 'manual',
    thresholds: [{ max: 0, score: 5 }],
    defaultScore: 1,
    options: [{ label: '', score: 5 }],
  }
}

function emptyItemType(): ItemTypeDraft {
  return { name: '', template: null, items: [emptyItem(), emptyItem()], categories: [emptyCategory()], externalCriteria: [] }
}

function templateToItemType(template: EventTemplate): ItemTypeDraft {
  return {
    name: template.label,
    template: template.id,
    items: [emptyItem(), emptyItem()],
    externalCriteria: [],
    categories: template.categories.map((c) => ({
      name: c.name,
      weight: c.weight,
      parameters: c.parameters.map((p) =>
        p.kind === 'scale'
          ? {
              name: p.name,
              weight: p.weight,
              kind: 'scale' as const,
              scaleMin: p.scaleMin,
              scaleMax: p.scaleMax,
              options: [],
              multiSelect: false,
            }
          : {
              name: p.name,
              weight: p.weight,
              kind: 'checklist' as const,
              scaleMin: 1,
              scaleMax: 5,
              options: [...p.options],
              multiSelect: p.multiSelect,
            }
      ),
    })),
  }
}

// Most templates share an id with their theme (e.g. template 'meat' -> theme
// 'meat'); only exceptions (like the systematic-tasting variant reusing the
// wine theme) need special-casing here.
const THEME_IDS: EventTheme[] = [
  'wine',
  'meat',
  'beer',
  'coffee',
  'whiskey',
  'cheese',
  'sausage',
  'burger',
  'pizza',
]

function themeForTemplate(templateId: string): EventTheme {
  if (templateId === 'wine_pro') return 'wine'
  if ((THEME_IDS as string[]).includes(templateId)) return templateId as EventTheme
  return 'default'
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
  const [itemTypes, setItemTypes] = useState<ItemTypeDraft[]>([emptyItemType()])
  const [visibility, setVisibility] = useState<ResultsVisibility>('manual')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function chooseTemplate(templateId: string) {
    const template = EVENT_TEMPLATES.find((t) => t.id === templateId)
    if (template) {
      setItemTypes([templateToItemType(template)])
      setTheme(themeForTemplate(template.id))
    }
    setStep('form')
  }

  function startFromScratch() {
    setItemTypes([emptyItemType()])
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

  function updateItemType(ti: number, patch: Partial<ItemTypeDraft>) {
    setItemTypes((prev) => prev.map((t, idx) => (idx === ti ? { ...t, ...patch } : t)))
  }
  function addItemType() {
    setItemTypes((prev) => [...prev, emptyItemType()])
  }
  function removeItemType(ti: number) {
    setItemTypes((prev) => prev.filter((_, idx) => idx !== ti))
  }
  function applyTemplateToItemType(ti: number, template: EventTemplate) {
    setItemTypes((prev) =>
      prev.map((t, idx) => {
        if (idx !== ti) return t
        const fromTemplate = templateToItemType(template)
        return { ...t, name: t.name || fromTemplate.name, template: template.id, categories: fromTemplate.categories }
      })
    )
  }

  function updateItemTypeItem(ti: number, i: number, patch: Partial<ItemDraft>) {
    setItemTypes((prev) =>
      prev.map((t, idx) =>
        idx === ti ? { ...t, items: t.items.map((v, j) => (j === i ? { ...v, ...patch } : v)) } : t
      )
    )
  }
  function addItemTypeItem(ti: number) {
    setItemTypes((prev) => prev.map((t, idx) => (idx === ti ? { ...t, items: [...t.items, emptyItem()] } : t)))
  }
  function removeItemTypeItem(ti: number, i: number) {
    setItemTypes((prev) =>
      prev.map((t, idx) => (idx === ti ? { ...t, items: t.items.filter((_, j) => j !== i) } : t))
    )
  }
  function updateItemExternalValue(ti: number, i: number, criterionIndex: number, value: string) {
    setItemTypes((prev) =>
      prev.map((t, idx) =>
        idx === ti
          ? {
              ...t,
              items: t.items.map((it, j) =>
                j === i ? { ...it, externalValues: { ...it.externalValues, [criterionIndex]: value } } : it
              ),
            }
          : t
      )
    )
  }

  function updateExternalCriterion(ti: number, ei: number, patch: Partial<ExternalCriterionDraft>) {
    setItemTypes((prev) =>
      prev.map((t, idx) =>
        idx === ti
          ? { ...t, externalCriteria: t.externalCriteria.map((c, j) => (j === ei ? { ...c, ...patch } : c)) }
          : t
      )
    )
  }
  function addExternalCriterion(ti: number) {
    setItemTypes((prev) =>
      prev.map((t, idx) =>
        idx === ti ? { ...t, externalCriteria: [...t.externalCriteria, emptyExternalCriterion()] } : t
      )
    )
  }
  function removeExternalCriterion(ti: number, ei: number) {
    setItemTypes((prev) =>
      prev.map((t, idx) => {
        if (idx !== ti) return t
        const externalCriteria = t.externalCriteria.filter((_, j) => j !== ei)
        const items = t.items.map((it) => {
          const externalValues: Record<number, string> = {}
          for (const [kStr, v] of Object.entries(it.externalValues)) {
            const k = Number(kStr)
            if (k === ei) continue
            externalValues[k > ei ? k - 1 : k] = v
          }
          return { ...it, externalValues }
        })
        return { ...t, externalCriteria, items }
      })
    )
  }
  function updateThreshold(ti: number, ei: number, thi: number, patch: Partial<ThresholdDraft>) {
    updateExternalCriterion(ti, ei, {
      thresholds: itemTypes[ti].externalCriteria[ei].thresholds.map((th, j) => (j === thi ? { ...th, ...patch } : th)),
    })
  }
  function addThreshold(ti: number, ei: number) {
    updateExternalCriterion(ti, ei, {
      thresholds: [...itemTypes[ti].externalCriteria[ei].thresholds, { max: 0, score: 1 }],
    })
  }
  function removeThreshold(ti: number, ei: number, thi: number) {
    updateExternalCriterion(ti, ei, {
      thresholds: itemTypes[ti].externalCriteria[ei].thresholds.filter((_, j) => j !== thi),
    })
  }
  function updateCriterionOption(ti: number, ei: number, oi: number, patch: Partial<OptionRuleDraft>) {
    updateExternalCriterion(ti, ei, {
      options: itemTypes[ti].externalCriteria[ei].options.map((o, j) => (j === oi ? { ...o, ...patch } : o)),
    })
  }
  function addCriterionOption(ti: number, ei: number) {
    updateExternalCriterion(ti, ei, {
      options: [...itemTypes[ti].externalCriteria[ei].options, { label: '', score: 5 }],
    })
  }
  function removeCriterionOption(ti: number, ei: number, oi: number) {
    updateExternalCriterion(ti, ei, {
      options: itemTypes[ti].externalCriteria[ei].options.filter((_, j) => j !== oi),
    })
  }

  function updateCategory(ti: number, ci: number, patch: Partial<CategoryDraft>) {
    setItemTypes((prev) =>
      prev.map((t, ti2) =>
        ti2 === ti
          ? { ...t, categories: t.categories.map((c, idx) => (idx === ci ? { ...c, ...patch } : c)) }
          : t
      )
    )
  }
  function addCategory(ti: number) {
    setItemTypes((prev) =>
      prev.map((t, idx) => (idx === ti ? { ...t, categories: [...t.categories, emptyCategory()] } : t))
    )
  }
  function removeCategory(ti: number, ci: number) {
    setItemTypes((prev) =>
      prev.map((t, idx) =>
        idx === ti ? { ...t, categories: t.categories.filter((_, j) => j !== ci) } : t
      )
    )
  }

  function updateParameter(ti: number, ci: number, pi: number, patch: Partial<ParameterDraft>) {
    setItemTypes((prev) =>
      prev.map((t, ti2) =>
        ti2 === ti
          ? {
              ...t,
              categories: t.categories.map((c, ci2) =>
                ci2 === ci
                  ? { ...c, parameters: c.parameters.map((p, j) => (j === pi ? { ...p, ...patch } : p)) }
                  : c
              ),
            }
          : t
      )
    )
  }
  function addParameter(ti: number, ci: number) {
    setItemTypes((prev) =>
      prev.map((t, ti2) =>
        ti2 === ti
          ? {
              ...t,
              categories: t.categories.map((c, idx) =>
                idx === ci ? { ...c, parameters: [...c.parameters, emptyParameter()] } : c
              ),
            }
          : t
      )
    )
  }
  function removeParameter(ti: number, ci: number, pi: number) {
    setItemTypes((prev) =>
      prev.map((t, ti2) =>
        ti2 === ti
          ? {
              ...t,
              categories: t.categories.map((c, idx) =>
                idx === ci ? { ...c, parameters: c.parameters.filter((_, j) => j !== pi) } : c
              ),
            }
          : t
      )
    )
  }

  function setParameterKind(ti: number, ci: number, pi: number, kind: ParameterKind) {
    updateParameter(
      ti,
      ci,
      pi,
      kind === 'scale' ? { kind, scaleMin: 1, scaleMax: 5 } : { kind, options: [''], multiSelect: false }
    )
  }

  function updateOption(ti: number, ci: number, pi: number, oi: number, value: string) {
    setItemTypes((prev) =>
      prev.map((t, ti2) =>
        ti2 === ti
          ? {
              ...t,
              categories: t.categories.map((c, ci2) =>
                ci2 === ci
                  ? {
                      ...c,
                      parameters: c.parameters.map((p, pi2) =>
                        pi2 === pi ? { ...p, options: p.options.map((o, k) => (k === oi ? value : o)) } : p
                      ),
                    }
                  : c
              ),
            }
          : t
      )
    )
  }
  function addOption(ti: number, ci: number, pi: number) {
    updateParameter(ti, ci, pi, {
      options: [...itemTypes[ti].categories[ci].parameters[pi].options, ''],
    })
  }
  function removeOption(ti: number, ci: number, pi: number, oi: number) {
    const current = itemTypes[ti].categories[ci].parameters[pi].options
    updateParameter(ti, ci, pi, { options: current.filter((_, k) => k !== oi) })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createEvent({
        title,
        resultsVisibility: visibility,
        theme,
        logoUrl,
        itemTypes: itemTypes.map((t) => ({
          name: t.name,
          template: t.template,
          items: t.items.map((it) => ({ label: it.label, externalValues: it.externalValues })),
          categories: t.categories.map((c) => ({
            name: c.name,
            weight: c.weight,
            parameters: c.parameters.map((p) =>
              p.kind === 'scale'
                ? { name: p.name, weight: p.weight, kind: 'scale' as const, scaleMin: p.scaleMin, scaleMax: p.scaleMax }
                : { name: p.name, weight: p.weight, kind: 'checklist' as const, options: p.options, multiSelect: p.multiSelect }
            ),
          })),
          externalCriteria: t.externalCriteria.map((c) => ({
            name: c.name,
            weight: c.weight,
            calcType: c.calcType,
            thresholds: c.calcType === 'threshold' ? c.thresholds : undefined,
            defaultScore: c.calcType === 'threshold' ? c.defaultScore : undefined,
            options: c.calcType === 'options' ? c.options : undefined,
          })),
        })),
      })
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      if (!('hostToken' in result) || !result.hostToken) {
        setError('שגיאה לא צפויה, נסה שוב')
        return
      }
      saveMyEvent({ title, hostToken: result.hostToken, createdAt: new Date().toISOString() })
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
              className={`flex flex-col items-center gap-1 rounded-xl border border-zinc-300 p-4 text-center font-medium ${THEME_STYLES[themeForTemplate(t.id)].bg}`}
            >
              <span className={`text-base font-semibold ${THEME_STYLES[themeForTemplate(t.id)].accent}`}>
                {t.label}
              </span>
              <span className={`text-xs font-normal ${THEME_STYLES[themeForTemplate(t.id)].muted}`}>
                תבנית מוכנה
              </span>
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
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
          placeholder="למשל: ערב הטעימות"
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

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-zinc-700">סוגי פריט</h2>
        {itemTypes.map((itemType, ti) => (
          <div key={ti} className="flex flex-col gap-4 rounded-2xl border-2 border-zinc-400 bg-white p-4">
            <div className="flex items-center gap-2">
              <input
                value={itemType.name}
                onChange={(e) => updateItemType(ti, { name: e.target.value })}
                placeholder={`סוג פריט ${ti + 1} (למשל: יין)`}
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base font-semibold focus:border-zinc-500 focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => removeItemType(ti)}
                disabled={itemTypes.length <= 1}
                aria-label="הסר סוג פריט"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 text-zinc-500 disabled:opacity-30"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="self-center text-xs text-zinc-500">מלא מתבנית:</span>
              {EVENT_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplateToItemType(ti, t)}
                  className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600"
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-zinc-500">פריטים ({itemType.name || 'סוג זה'})</h3>
              {itemType.items.map((item, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={item.label}
                      onChange={(e) => updateItemTypeItem(ti, i, { label: e.target.value })}
                      placeholder={`פריט ${i + 1}`}
                      className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-500 focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => removeItemTypeItem(ti, i)}
                      disabled={itemType.items.length <= 2}
                      aria-label="הסר פריט"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 text-zinc-500 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                  {itemType.externalCriteria.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {itemType.externalCriteria.map((crit, ei) => (
                        <label key={ei} className="flex min-w-[110px] flex-1 flex-col gap-1 text-xs text-zinc-500">
                          {crit.name || `קריטריון ${ei + 1}`}
                          {crit.calcType === 'options' ? (
                            <select
                              value={item.externalValues[ei] ?? ''}
                              onChange={(e) => updateItemExternalValue(ti, i, ei, e.target.value)}
                              className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                            >
                              <option value="">—</option>
                              {crit.options.map((opt, oi) => (
                                <option key={oi} value={opt.label}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="number"
                              step="any"
                              value={item.externalValues[ei] ?? ''}
                              onChange={(e) => updateItemExternalValue(ti, i, ei, e.target.value)}
                              className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addItemTypeItem(ti)}
                className="self-start rounded-lg border border-dashed border-zinc-400 px-3 py-1.5 text-xs font-medium text-zinc-600"
              >
                + הוסף פריט
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-medium text-zinc-500">קטגוריות ותת-שאלות</h3>
              {itemType.categories.map((category, ci) => (
                <div key={ci} className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-zinc-50 p-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={category.name}
                        onChange={(e) => updateCategory(ti, ci, { name: e.target.value })}
                        placeholder={`קטגוריה ${ci + 1} (למשל: אף)`}
                        className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base font-medium focus:border-zinc-500 focus:outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => removeCategory(ti, ci)}
                        disabled={itemType.categories.length <= 1}
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
                        onChange={(e) => updateCategory(ti, ci, { weight: Number(e.target.value) })}
                        className="w-20 shrink-0 rounded-lg border border-zinc-300 px-2 py-2 text-base focus:border-zinc-500 focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="flex flex-col gap-2 border-r-2 border-zinc-200 pr-3">
                    {category.parameters.map((p, pi) => (
                      <div key={pi} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3">
                        <div className="flex items-center gap-2">
                          <input
                            value={p.name}
                            onChange={(e) => updateParameter(ti, ci, pi, { name: e.target.value })}
                            placeholder={`תת-שאלה ${pi + 1}`}
                            className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base focus:border-zinc-500 focus:outline-none"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => removeParameter(ti, ci, pi)}
                            disabled={category.parameters.length <= 1}
                            aria-label="הסר תת-שאלה"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 text-zinc-500 disabled:opacity-30"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setParameterKind(ti, ci, pi, 'scale')}
                            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                              p.kind === 'scale' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 text-zinc-600'
                            }`}
                          >
                            סולם מספרי
                          </button>
                          <button
                            type="button"
                            onClick={() => setParameterKind(ti, ci, pi, 'checklist')}
                            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                              p.kind === 'checklist' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 text-zinc-600'
                            }`}
                          >
                            רשימת אפשרויות
                          </button>
                        </div>

                        {p.kind === 'scale' ? (
                          <>
                            <label className="flex flex-col gap-1 text-xs text-zinc-500">
                              משקל
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={p.weight}
                                onChange={(e) => updateParameter(ti, ci, pi, { weight: Number(e.target.value) })}
                                className="w-full min-w-0 rounded-lg border border-zinc-300 px-2 py-2 text-base focus:border-zinc-500 focus:outline-none"
                              />
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-500">
                                סולם מ-
                                <input
                                  type="number"
                                  value={p.scaleMin}
                                  onChange={(e) => updateParameter(ti, ci, pi, { scaleMin: Number(e.target.value) })}
                                  className="w-full min-w-0 rounded-lg border border-zinc-300 px-2 py-2 text-base focus:border-zinc-500 focus:outline-none"
                                />
                              </label>
                              <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-500">
                                סולם עד
                                <input
                                  type="number"
                                  value={p.scaleMax}
                                  onChange={(e) => updateParameter(ti, ci, pi, { scaleMax: Number(e.target.value) })}
                                  className="w-full min-w-0 rounded-lg border border-zinc-300 px-2 py-2 text-base focus:border-zinc-500 focus:outline-none"
                                />
                              </label>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 text-xs text-zinc-500">
                              <input
                                type="checkbox"
                                checked={p.multiSelect}
                                onChange={(e) => updateParameter(ti, ci, pi, { multiSelect: e.target.checked })}
                              />
                              אפשר בחירה מרובה
                            </label>
                            <div className="flex flex-col gap-1.5">
                              {p.options.map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-2">
                                  <input
                                    value={opt}
                                    onChange={(e) => updateOption(ti, ci, pi, oi, e.target.value)}
                                    placeholder={`אפשרות ${oi + 1}`}
                                    className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
                                    required
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeOption(ti, ci, pi, oi)}
                                    disabled={p.options.length <= 1}
                                    aria-label="הסר אפשרות"
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-300 text-zinc-500 disabled:opacity-30"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => addOption(ti, ci, pi)}
                                className="self-start rounded-lg border border-dashed border-zinc-400 px-3 py-1 text-xs font-medium text-zinc-600"
                              >
                                + הוסף אפשרות
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addParameter(ti, ci)}
                      className="self-start rounded-lg border border-dashed border-zinc-400 px-3 py-1.5 text-xs font-medium text-zinc-600"
                    >
                      + הוסף תת-שאלה
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addCategory(ti)}
                className="self-start rounded-xl border border-dashed border-zinc-400 px-4 py-2 text-sm font-medium text-zinc-600"
              >
                + הוסף קטגוריה
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-medium text-zinc-500">
                קריטריונים חיצוניים (אופציונלי) — למשל מחיר, יבוא/מקומי
              </h3>
              {itemType.externalCriteria.map((crit, ei) => (
                <div key={ei} className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-zinc-50 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={crit.name}
                      onChange={(e) => updateExternalCriterion(ti, ei, { name: e.target.value })}
                      placeholder="שם הקריטריון (למשל: מחיר)"
                      className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base focus:border-zinc-500 focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => removeExternalCriterion(ti, ei)}
                      aria-label="הסר קריטריון"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 text-zinc-500"
                    >
                      ✕
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-zinc-500">
                    משקל (כמו משקל קטגוריה)
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={crit.weight}
                      onChange={(e) => updateExternalCriterion(ti, ei, { weight: Number(e.target.value) })}
                      className="w-20 shrink-0 rounded-lg border border-zinc-300 px-2 py-2 text-base focus:border-zinc-500 focus:outline-none"
                    />
                  </label>

                  <div className="flex gap-2">
                    {(
                      [
                        { value: 'manual', label: 'ציון ידני' },
                        { value: 'threshold', label: 'טבלת ספים' },
                        { value: 'options', label: 'רשימת אפשרויות' },
                      ] as { value: ExternalCriterionCalcType; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateExternalCriterion(ti, ei, { calcType: opt.value })}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                          crit.calcType === opt.value
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-300 text-zinc-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {crit.calcType === 'manual' && (
                    <p className="text-xs text-zinc-400">תזין ציון (1-5) ישירות לכל פריט למטה, בסעיף הפריטים</p>
                  )}

                  {crit.calcType === 'threshold' && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs text-zinc-500">טווחי ערך ← ציון (מהנמוך לגבוה)</span>
                      {crit.thresholds.map((th, thi) => (
                        <div key={thi} className="flex items-center gap-2">
                          <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-500">
                            עד ערך
                            <input
                              type="number"
                              step="any"
                              value={th.max}
                              onChange={(e) => updateThreshold(ti, ei, thi, { max: Number(e.target.value) })}
                              className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-500">
                            ציון
                            <input
                              type="number"
                              step="any"
                              value={th.score}
                              onChange={(e) => updateThreshold(ti, ei, thi, { score: Number(e.target.value) })}
                              className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => removeThreshold(ti, ei, thi)}
                            disabled={crit.thresholds.length <= 1}
                            aria-label="הסר סף"
                            className="flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-lg border border-zinc-300 text-zinc-500 disabled:opacity-30"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addThreshold(ti, ei)}
                        className="self-start rounded-lg border border-dashed border-zinc-400 px-3 py-1 text-xs font-medium text-zinc-600"
                      >
                        + הוסף סף
                      </button>
                      <label className="flex items-center gap-2 text-xs text-zinc-500">
                        ציון מעל כל הספים
                        <input
                          type="number"
                          step="any"
                          value={crit.defaultScore}
                          onChange={(e) => updateExternalCriterion(ti, ei, { defaultScore: Number(e.target.value) })}
                          className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                        />
                      </label>
                    </div>
                  )}

                  {crit.calcType === 'options' && (
                    <div className="flex flex-col gap-2">
                      {crit.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            value={opt.label}
                            onChange={(e) => updateCriterionOption(ti, ei, oi, { label: e.target.value })}
                            placeholder="תווית (למשל: יבוא)"
                            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                            required
                          />
                          <input
                            type="number"
                            step="any"
                            value={opt.score}
                            onChange={(e) => updateCriterionOption(ti, ei, oi, { score: Number(e.target.value) })}
                            className="w-16 shrink-0 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeCriterionOption(ti, ei, oi)}
                            disabled={crit.options.length <= 1}
                            aria-label="הסר אפשרות"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-300 text-zinc-500 disabled:opacity-30"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addCriterionOption(ti, ei)}
                        className="self-start rounded-lg border border-dashed border-zinc-400 px-3 py-1 text-xs font-medium text-zinc-600"
                      >
                        + הוסף אפשרות
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addExternalCriterion(ti)}
                className="self-start rounded-lg border border-dashed border-zinc-400 px-3 py-1.5 text-xs font-medium text-zinc-600"
              >
                + הוסף קריטריון חיצוני
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addItemType}
          className="self-start rounded-xl border border-dashed border-zinc-500 px-4 py-2 text-sm font-medium text-zinc-700"
        >
          + הוסף סוג פריט (למשל: גם בשר לצד היין)
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

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

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
