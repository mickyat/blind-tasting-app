'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { EventTheme, ResultsVisibility } from '@/lib/types'

interface ParameterInput {
  name: string
  weight: number
  scaleMin: number
  scaleMax: number
}

interface CategoryInput {
  name: string
  weight: number
  parameters: ParameterInput[]
}

interface CreateEventInput {
  title: string
  resultsVisibility: ResultsVisibility
  items: string[]
  categories: CategoryInput[]
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

  const items = input.items.map((s) => s.trim()).filter(Boolean)
  if (items.length < 2) return { error: 'צריך לפחות שני פריטים להטעימה' }

  const categories = input.categories
    .map((c) => ({
      ...c,
      name: c.name.trim(),
      parameters: c.parameters.map((p) => ({ ...p, name: p.name.trim() })).filter((p) => p.name),
    }))
    .filter((c) => c.name)

  if (categories.length === 0) return { error: 'צריך לפחות קטגוריה אחת' }

  for (const c of categories) {
    if (!(c.weight > 0)) return { error: `משקל לא תקין עבור קטגוריה "${c.name}"` }
    if (c.parameters.length === 0) {
      return { error: `צריך לפחות תת-שאלה אחת בקטגוריה "${c.name}"` }
    }
    for (const p of c.parameters) {
      if (!(p.weight > 0)) return { error: `משקל לא תקין עבור "${p.name}"` }
      if (
        !(Number.isFinite(p.scaleMin) && Number.isFinite(p.scaleMax)) ||
        p.scaleMax <= p.scaleMin
      ) {
        return { error: `טווח סולם לא תקין עבור "${p.name}"` }
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

  const { data: admin, error: adminError } = await supabase
    .from('event_admin')
    .insert({ event_id: event.id })
    .select()
    .single()

  if (adminError || !admin) {
    await supabase.from('event').delete().eq('id', event.id)
    return { error: 'שגיאה ביצירת האירוע, נסה שוב' }
  }

  const { error: itemsError } = await supabase.from('item').insert(
    items.map((label, i) => ({ event_id: event.id, label, sort_order: i }))
  )
  if (itemsError) {
    await supabase.from('event').delete().eq('id', event.id)
    return { error: 'שגיאה בהוספת הפריטים, נסה שוב' }
  }

  const { data: categoryRows, error: categoriesError } = await supabase
    .from('category')
    .insert(
      categories.map((c, i) => ({
        event_id: event.id,
        name: c.name,
        weight: c.weight,
        sort_order: i,
      }))
    )
    .select()

  if (categoriesError || !categoryRows) {
    await supabase.from('event').delete().eq('id', event.id)
    return { error: 'שגיאה בהוספת הקטגוריות, נסה שוב' }
  }

  const parameterRows = categories.flatMap((c, i) =>
    c.parameters.map((p, j) => ({
      category_id: categoryRows[i].id,
      name: p.name,
      weight: p.weight,
      scale_min: p.scaleMin,
      scale_max: p.scaleMax,
      sort_order: j,
    }))
  )

  const { error: paramsError } = await supabase.from('parameter').insert(parameterRows)
  if (paramsError) {
    await supabase.from('event').delete().eq('id', event.id)
    return { error: 'שגיאה בהוספת השאלות, נסה שוב' }
  }

  return {
    shareToken: event.share_token as string,
    hostToken: admin.host_token as string,
  }
}

export async function openResults(hostToken: string) {
  const supabase = createAdminClient()

  const { data: admin } = await supabase
    .from('event_admin')
    .select('event_id')
    .eq('host_token', hostToken)
    .maybeSingle()

  if (!admin) return { error: 'קישור ניהול לא תקין' }

  const { error } = await supabase
    .from('event')
    .update({ results_open: true })
    .eq('id', admin.event_id)

  if (error) return { error: 'שגיאה בפתיחת התוצאות' }
  return { ok: true }
}
