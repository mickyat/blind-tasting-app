'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { ResultsVisibility } from '@/lib/types'

interface CreateEventInput {
  title: string
  resultsVisibility: ResultsVisibility
  items: string[]
  parameters: {
    name: string
    weight: number
    scaleMin: number
    scaleMax: number
  }[]
}

export async function createEvent(input: CreateEventInput) {
  const title = input.title.trim()
  if (!title) return { error: 'צריך לתת שם לאירוע' }

  const items = input.items.map((s) => s.trim()).filter(Boolean)
  if (items.length < 2) return { error: 'צריך לפחות שני פריטים להטעימה' }

  const parameters = input.parameters
    .map((p) => ({ ...p, name: p.name.trim() }))
    .filter((p) => p.name)
  if (parameters.length === 0) return { error: 'צריך לפחות פרמטר אחד לניקוד' }

  for (const p of parameters) {
    if (!(p.weight > 0)) return { error: `משקל לא תקין עבור "${p.name}"` }
    if (!(Number.isFinite(p.scaleMin) && Number.isFinite(p.scaleMax)) || p.scaleMax <= p.scaleMin) {
      return { error: `טווח סולם לא תקין עבור "${p.name}"` }
    }
  }

  const supabase = createAdminClient()

  const { data: event, error: eventError } = await supabase
    .from('event')
    .insert({ title, results_visibility: input.resultsVisibility })
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

  const { error: paramsError } = await supabase.from('parameter').insert(
    parameters.map((p, i) => ({
      event_id: event.id,
      name: p.name,
      weight: p.weight,
      scale_min: p.scaleMin,
      scale_max: p.scaleMax,
      sort_order: i,
    }))
  )
  if (paramsError) {
    await supabase.from('event').delete().eq('id', event.id)
    return { error: 'שגיאה בהוספת הפרמטרים, נסה שוב' }
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
