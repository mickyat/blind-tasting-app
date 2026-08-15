'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type {
  EventTheme,
  ExternalCriterionCalcType,
  ParameterKind,
  ResultsVisibility,
  ThresholdDirection,
} from '@/lib/types'

interface ParameterInput {
  name: string
  weight: number
  kind: ParameterKind
  scaleMin?: number
  scaleMax?: number
  options?: string[]
  multiSelect?: boolean
}

interface CategoryInput {
  name: string
  weight: number
  parameters: ParameterInput[]
}

interface ExternalCriterionInput {
  name: string
  weight: number
  calcType: ExternalCriterionCalcType
  thresholds?: { direction: ThresholdDirection; value: number; score: number }[]
  options?: { label: string; score: number }[]
}

interface ItemInput {
  label: string
  externalValues: Record<number, string>
}

interface ItemTypeInput {
  name: string
  template: string | null
  items: ItemInput[]
  categories: CategoryInput[]
  externalCriteria: ExternalCriterionInput[]
}

interface CreateEventInput {
  title: string
  resultsVisibility: ResultsVisibility
  itemTypes: ItemTypeInput[]
  theme: EventTheme
  logoUrl: string | null
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

export async function uploadEventLogo(formData: FormData) {
  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'לא נבחר קובץ' }
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { error: 'סוג קובץ לא נתמך (רק PNG / JPEG / WebP / SVG)' }
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: 'הקובץ גדול מדי (עד 2MB)' }
  }

  const supabase = createAdminClient()
  const ext = file.name.split('.').pop() || 'png'
  const path = `${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('event-logos')
    .upload(path, file, { contentType: file.type })

  if (uploadError) {
    return { error: 'שגיאה בהעלאת הלוגו, נסה שוב' }
  }

  const { data } = supabase.storage.from('event-logos').getPublicUrl(path)
  return { url: data.publicUrl }
}

export async function createEvent(input: CreateEventInput) {
  const title = input.title.trim()
  if (!title) return { error: 'צריך לתת שם לאירוע' }

  const itemTypes = input.itemTypes.map((t) => ({
    name: t.name.trim(),
    template: t.template,
    items: t.items
      .map((item) => ({ label: item.label.trim(), externalValues: item.externalValues }))
      .filter((item) => item.label),
    categories: t.categories
      .map((c) => ({
        ...c,
        name: c.name.trim(),
        parameters: c.parameters
          .map((p) => ({ ...p, name: p.name.trim() }))
          .filter((p) => p.name),
      }))
      .filter((c) => c.name),
    externalCriteria: t.externalCriteria
      .map((c) => ({ ...c, name: c.name.trim() }))
      .filter((c) => c.name),
  }))

  if (itemTypes.length === 0) return { error: 'צריך לפחות סוג פריט אחד' }

  for (const t of itemTypes) {
    if (!t.name) return { error: 'צריך שם לכל סוג פריט' }
    if (t.items.length < 2) return { error: `צריך לפחות שני פריטים תחת "${t.name}"` }
    if (t.categories.length === 0) return { error: `צריך לפחות קטגוריה אחת תחת "${t.name}"` }
    for (const c of t.categories) {
      if (!(c.weight > 0)) return { error: `משקל לא תקין עבור קטגוריה "${c.name}"` }
      if (c.parameters.length === 0) {
        return { error: `צריך לפחות תת-שאלה אחת בקטגוריה "${c.name}"` }
      }
      for (const p of c.parameters) {
        if (p.kind === 'scale') {
          if (!(p.weight > 0)) return { error: `משקל לא תקין עבור "${p.name}"` }
          if (
            !(Number.isFinite(p.scaleMin) && Number.isFinite(p.scaleMax)) ||
            (p.scaleMax as number) <= (p.scaleMin as number)
          ) {
            return { error: `טווח סולם לא תקין עבור "${p.name}"` }
          }
        } else {
          if (!p.options || p.options.filter((o) => o.trim()).length === 0) {
            return { error: `צריך לפחות אפשרות אחת עבור "${p.name}"` }
          }
        }
      }
    }
    for (const c of t.externalCriteria) {
      if (!(c.weight > 0)) return { error: `משקל לא תקין עבור הקריטריון "${c.name}"` }
      if (c.calcType === 'threshold') {
        if (!c.thresholds || c.thresholds.length === 0) {
          return { error: `צריך לפחות סף אחד עבור "${c.name}"` }
        }
      }
      if (c.calcType === 'options') {
        if (!c.options || c.options.length === 0) {
          return { error: `צריך לפחות אפשרות אחת עבור "${c.name}"` }
        }
      }
    }
  }

  const supabase = createAdminClient()

  const { data: event, error: eventError } = await supabase
    .from('event')
    .insert({
      title,
      results_visibility: input.resultsVisibility,
      theme: input.theme,
      logo_url: input.logoUrl,
    })
    .select()
    .single()

  if (eventError || !event) {
    return { error: 'שגיאה ביצירת האירוע, נסה שוב' }
  }

  const rollback = async () => {
    await supabase.from('event').delete().eq('id', event.id)
  }

  const { data: admin, error: adminError } = await supabase
    .from('event_admin')
    .insert({ event_id: event.id })
    .select()
    .single()

  if (adminError || !admin) {
    await rollback()
    return { error: 'שגיאה ביצירת האירוע, נסה שוב' }
  }

  const { data: itemTypeRows, error: itemTypeError } = await supabase
    .from('item_type')
    .insert(
      itemTypes.map((t, i) => ({
        event_id: event.id,
        name: t.name,
        template: t.template,
        sort_order: i,
      }))
    )
    .select()

  if (itemTypeError || !itemTypeRows) {
    await rollback()
    return { error: 'שגיאה בהוספת סוגי הפריט, נסה שוב' }
  }

  const itemPlan = itemTypes.flatMap((t, i) => t.items.map((item) => ({ typeIndex: i, item })))
  const { data: itemRows, error: itemsError } = await supabase
    .from('item')
    .insert(
      itemPlan.map(({ typeIndex, item }, idx) => ({
        item_type_id: itemTypeRows[typeIndex].id,
        label: item.label,
        sort_order: idx,
      }))
    )
    .select()
  if (itemsError || !itemRows) {
    await rollback()
    return { error: 'שגיאה בהוספת הפריטים, נסה שוב' }
  }

  const categoryPlan = itemTypes.flatMap((t, i) => t.categories.map((c) => ({ typeIndex: i, c })))
  const { data: categoryRows, error: categoriesError } = await supabase
    .from('category')
    .insert(
      categoryPlan.map(({ typeIndex, c }, idx) => ({
        item_type_id: itemTypeRows[typeIndex].id,
        name: c.name,
        weight: c.weight,
        sort_order: idx,
      }))
    )
    .select()

  if (categoriesError || !categoryRows) {
    await rollback()
    return { error: 'שגיאה בהוספת הקטגוריות, נסה שוב' }
  }

  const parameterPlan = categoryPlan.flatMap(({ c }, ci) => c.parameters.map((p) => ({ ci, p })))
  const { error: paramsError } = await supabase.from('parameter').insert(
    parameterPlan.map(({ ci, p }, idx) => ({
      category_id: categoryRows[ci].id,
      name: p.name,
      weight: p.weight,
      kind: p.kind,
      scale_min: p.kind === 'scale' ? p.scaleMin : null,
      scale_max: p.kind === 'scale' ? p.scaleMax : null,
      options: p.kind === 'checklist' ? p.options : null,
      multi_select: p.kind === 'checklist' ? !!p.multiSelect : false,
      sort_order: idx,
    }))
  )
  if (paramsError) {
    await rollback()
    return { error: 'שגיאה בהוספת השאלות, נסה שוב' }
  }

  const criterionPlan = itemTypes.flatMap((t, i) =>
    t.externalCriteria.map((c, j) => ({ typeIndex: i, localIndex: j, c }))
  )
  const criterionIdByKey = new Map<string, string>()
  if (criterionPlan.length > 0) {
    const { data: criterionRows, error: criterionError } = await supabase
      .from('external_criterion')
      .insert(
        criterionPlan.map(({ typeIndex, c }, idx) => ({
          item_type_id: itemTypeRows[typeIndex].id,
          name: c.name,
          weight: c.weight,
          calc_type: c.calcType,
          config:
            c.calcType === 'threshold'
              ? { thresholds: c.thresholds }
              : c.calcType === 'options'
                ? { options: c.options }
                : null,
          sort_order: idx,
        }))
      )
      .select()

    if (criterionError || !criterionRows) {
      await rollback()
      return { error: 'שגיאה בהוספת הקריטריונים החיצוניים, נסה שוב' }
    }

    criterionPlan.forEach((entry, idx) => {
      criterionIdByKey.set(`${entry.typeIndex}:${entry.localIndex}`, criterionRows[idx].id)
    })
  }

  const externalValueRows: { item_id: string; criterion_id: string; raw_value: string }[] = []
  itemPlan.forEach(({ typeIndex, item }, idx) => {
    const itemId = itemRows[idx].id
    for (const [localIndex, rawValue] of Object.entries(item.externalValues)) {
      if (!rawValue) continue
      const criterionId = criterionIdByKey.get(`${typeIndex}:${localIndex}`)
      if (!criterionId) continue
      externalValueRows.push({ item_id: itemId, criterion_id: criterionId, raw_value: rawValue })
    }
  })
  if (externalValueRows.length > 0) {
    const { error: valuesError } = await supabase.from('item_external_value').insert(externalValueRows)
    if (valuesError) {
      await rollback()
      return { error: 'שגיאה בהוספת ערכי הקריטריונים, נסה שוב' }
    }
  }

  return {
    eventId: event.id as string,
    shareToken: event.share_token as string,
    hostToken: admin.host_token as string,
  }
}

// Opens results for every item in the event at once (the "הצג תוצאות"
// bulk button). Per-item publishing (openItemResults) is the finer-grained
// alternative.
export async function openResults(hostToken: string) {
  const supabase = createAdminClient()

  const { data: admin } = await supabase
    .from('event_admin')
    .select('event_id')
    .eq('host_token', hostToken)
    .maybeSingle()

  if (!admin) return { error: 'קישור ניהול לא תקין' }

  const { data: types } = await supabase.from('item_type').select('id').eq('event_id', admin.event_id)
  const typeIds = (types ?? []).map((t) => t.id)

  if (typeIds.length > 0) {
    const { error: itemsError } = await supabase
      .from('item')
      .update({ results_open: true })
      .in('item_type_id', typeIds)
    if (itemsError) return { error: 'שגיאה בפתיחת התוצאות' }
  }

  const { error } = await supabase.from('event').update({ results_open: true }).eq('id', admin.event_id)
  if (error) return { error: 'שגיאה בפתיחת התוצאות' }
  return { ok: true }
}

export async function openItemResults(hostToken: string, itemId: string) {
  const supabase = createAdminClient()

  const { data: admin } = await supabase
    .from('event_admin')
    .select('event_id')
    .eq('host_token', hostToken)
    .maybeSingle()

  if (!admin) return { error: 'קישור ניהול לא תקין' }

  const { data: item } = await supabase.from('item').select('id, item_type_id').eq('id', itemId).maybeSingle()
  if (!item) return { error: 'הפריט לא נמצא' }

  const { data: itemType } = await supabase
    .from('item_type')
    .select('event_id')
    .eq('id', item.item_type_id)
    .maybeSingle()

  if (!itemType || itemType.event_id !== admin.event_id) {
    return { error: 'הפריט לא שייך לאירוע הזה' }
  }

  const { error } = await supabase.from('item').update({ results_open: true }).eq('id', itemId)
  if (error) return { error: 'שגיאה בפתיחת התוצאות לפריט' }
  return { ok: true }
}

// Lets the organizer fill in / edit an external criterion's value for one
// item after the event was created (there's no other way to change these
// once the event exists). Host-token-authenticated, same pattern as
// openItemResults: verify the item and the criterion both belong to the
// event this host_token owns before writing.
export async function updateExternalValue(hostToken: string, itemId: string, criterionId: string, rawValue: string) {
  const supabase = createAdminClient()

  const { data: admin } = await supabase
    .from('event_admin')
    .select('event_id')
    .eq('host_token', hostToken)
    .maybeSingle()

  if (!admin) return { error: 'קישור ניהול לא תקין' }

  const { data: item } = await supabase.from('item').select('id, item_type_id').eq('id', itemId).maybeSingle()
  if (!item) return { error: 'הפריט לא נמצא' }

  const { data: criterion } = await supabase
    .from('external_criterion')
    .select('id, item_type_id')
    .eq('id', criterionId)
    .maybeSingle()
  if (!criterion || criterion.item_type_id !== item.item_type_id) {
    return { error: 'הקריטריון לא שייך לפריט הזה' }
  }

  const { data: itemType } = await supabase
    .from('item_type')
    .select('event_id')
    .eq('id', item.item_type_id)
    .maybeSingle()
  if (!itemType || itemType.event_id !== admin.event_id) {
    return { error: 'הפריט לא שייך לאירוע הזה' }
  }

  const trimmed = rawValue.trim()
  if (!trimmed) {
    const { error } = await supabase
      .from('item_external_value')
      .delete()
      .eq('item_id', itemId)
      .eq('criterion_id', criterionId)
    if (error) return { error: 'שגיאה במחיקת הערך' }
    return { ok: true }
  }

  const { error } = await supabase
    .from('item_external_value')
    .upsert({ item_id: itemId, criterion_id: criterionId, raw_value: trimmed }, { onConflict: 'item_id,criterion_id' })
  if (error) return { error: 'שגיאה בשמירת הערך' }
  return { ok: true }
}

async function verifyHostOwnsItem(
  supabase: ReturnType<typeof createAdminClient>,
  hostToken: string,
  itemId: string
) {
  const { data: admin } = await supabase
    .from('event_admin')
    .select('event_id')
    .eq('host_token', hostToken)
    .maybeSingle()
  if (!admin) return { error: 'קישור ניהול לא תקין' } as const

  const { data: item } = await supabase.from('item').select('id, item_type_id').eq('id', itemId).maybeSingle()
  if (!item) return { error: 'הפריט לא נמצא' } as const

  const { data: itemType } = await supabase
    .from('item_type')
    .select('event_id')
    .eq('id', item.item_type_id)
    .maybeSingle()
  if (!itemType || itemType.event_id !== admin.event_id) return { error: 'הפריט לא שייך לאירוע הזה' } as const

  return { ok: true } as const
}

// Organizer-only, set after the event was already created (there's no
// other way to attach these). No OCR/processing of the photo - it's stored
// and shown exactly as uploaded, same as the event logo. Reuses the
// existing public `event-logos` bucket rather than provisioning a new one.
export async function uploadItemPhoto(hostToken: string, itemId: string, formData: FormData) {
  const supabase = createAdminClient()

  const ownership = await verifyHostOwnsItem(supabase, hostToken, itemId)
  if ('error' in ownership) return ownership

  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'לא נבחר קובץ' }
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { error: 'סוג קובץ לא נתמך (רק PNG / JPEG / WebP / SVG)' }
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: 'הקובץ גדול מדי (עד 2MB)' }
  }

  const ext = file.name.split('.').pop() || 'png'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('event-logos')
    .upload(path, file, { contentType: file.type })
  if (uploadError) return { error: 'שגיאה בהעלאת התמונה, נסה שוב' }

  const { data } = supabase.storage.from('event-logos').getPublicUrl(path)

  const { error } = await supabase.from('item').update({ image_url: data.publicUrl }).eq('id', itemId)
  if (error) return { error: 'שגיאה בשמירת התמונה' }
  return { url: data.publicUrl }
}

export async function removeItemPhoto(hostToken: string, itemId: string) {
  const supabase = createAdminClient()
  const ownership = await verifyHostOwnsItem(supabase, hostToken, itemId)
  if ('error' in ownership) return ownership

  const { error } = await supabase.from('item').update({ image_url: null }).eq('id', itemId)
  if (error) return { error: 'שגיאה בהסרת התמונה' }
  return { ok: true }
}

export async function updateItemLabel(hostToken: string, itemId: string, customLabel: string) {
  const supabase = createAdminClient()
  const ownership = await verifyHostOwnsItem(supabase, hostToken, itemId)
  if ('error' in ownership) return ownership

  const trimmed = customLabel.trim()
  const { error } = await supabase
    .from('item')
    .update({ custom_label: trimmed || null })
    .eq('id', itemId)
  if (error) return { error: 'שגיאה בשמירת התיאור' }
  return { ok: true }
}
