'use server'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveLocale } from '@/i18n/request'
import { VISITOR_ID_COOKIE, VISITOR_ID_COOKIE_MAX_AGE } from '@/lib/visitor'
import type {
  EventTheme,
  ExternalCriterionCalcType,
  ParameterKind,
  ResultsRevealMode,
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
  // Client-generated (crypto.randomUUID(), never stored in the DB) - lets
  // the form correlate each draft item with its real item.id after
  // creation, so it knows which uploadItemPhoto(hostToken, itemId, ...)
  // call goes with which pending photo file. Array position alone isn't
  // reliable since items with an empty label get filtered out below.
  clientKey: string
  // Organizer's optional temporary placeholder, only meaningful when
  // hideItemIdentity (below) is on - null/empty falls back to an auto
  // "Item N" computed client-side.
  blindLabel: string | null
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
  prizeDescription: string | null
  resultsRevealMode: ResultsRevealMode
  hideItemIdentity: boolean
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

// Server actions can't call useTranslations (not a component), so failures
// return a stable errorKey (+ optional interpolation params) instead of a
// ready-made string - the client resolves it via t(`errors.${errorKey}`,
// errorParams) using its own locale. See src/messages/{he,en}.json "errors".
function err(errorKey: string, errorParams?: Record<string, string>) {
  return { errorKey, errorParams }
}

export async function uploadEventLogo(formData: FormData) {
  const file = formData.get('file')
  if (!(file instanceof File)) return err('noFileSelected')
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return err('unsupportedFileType')
  }
  if (file.size > MAX_LOGO_BYTES) {
    return err('fileTooLarge')
  }

  const supabase = createAdminClient()
  const ext = file.name.split('.').pop() || 'png'
  const path = `${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('event-logos')
    .upload(path, file, { contentType: file.type })

  if (uploadError) {
    return err('logoUploadFailed')
  }

  const { data } = supabase.storage.from('event-logos').getPublicUrl(path)
  return { url: data.publicUrl }
}

export async function createEvent(input: CreateEventInput) {
  const title = input.title.trim()
  if (!title) return err('titleRequired')

  const itemTypes = input.itemTypes.map((t) => ({
    name: t.name.trim(),
    template: t.template,
    items: t.items
      .map((item) => ({
        label: item.label.trim(),
        externalValues: item.externalValues,
        clientKey: item.clientKey,
        blindLabel: item.blindLabel?.trim() || null,
      }))
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

  if (itemTypes.length === 0) return err('atLeastOneItemType')

  for (const t of itemTypes) {
    if (!t.name) return err('itemTypeNameRequired')
    if (t.items.length < 2) return err('atLeastTwoItems', { name: t.name })
    if (t.categories.length === 0) return err('atLeastOneCategory', { name: t.name })
    for (const c of t.categories) {
      if (!(c.weight > 0)) return err('invalidCategoryWeight', { name: c.name })
      if (c.parameters.length === 0) {
        return err('atLeastOneParameter', { name: c.name })
      }
      for (const p of c.parameters) {
        if (p.kind === 'scale') {
          if (!(p.weight > 0)) return err('invalidParameterWeight', { name: p.name })
          if (
            !(Number.isFinite(p.scaleMin) && Number.isFinite(p.scaleMax)) ||
            (p.scaleMax as number) <= (p.scaleMin as number)
          ) {
            return err('invalidScaleRange', { name: p.name })
          }
        } else {
          if (!p.options || p.options.filter((o) => o.trim()).length === 0) {
            return err('atLeastOneOption', { name: p.name })
          }
        }
      }
    }
    for (const c of t.externalCriteria) {
      if (!(c.weight > 0)) return err('invalidCriterionWeight', { name: c.name })
      if (c.calcType === 'threshold') {
        if (!c.thresholds || c.thresholds.length === 0) {
          return err('atLeastOneThreshold', { name: c.name })
        }
      }
      if (c.calcType === 'options') {
        if (!c.options || c.options.length === 0) {
          return err('atLeastOneOption', { name: c.name })
        }
      }
    }
  }

  const supabase = createAdminClient()

  // Captured only for the owner-only /admin stats panel (Hebrew-vs-English
  // breakdown) - not used anywhere in the app's own behavior, so a resolution
  // failure here should never block event creation.
  const locale = await resolveLocale().catch(() => null)

  const { data: event, error: eventError } = await supabase
    .from('event')
    .insert({
      title,
      results_visibility: input.resultsVisibility,
      theme: input.theme,
      logo_url: input.logoUrl,
      prize_description: input.prizeDescription,
      results_reveal_mode: input.resultsRevealMode,
      hide_item_identity: input.hideItemIdentity,
      locale,
    })
    .select()
    .single()

  if (eventError || !event) {
    return err('eventCreationFailed')
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
    return err('eventCreationFailed')
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
    return err('itemTypeInsertFailed')
  }

  const itemPlan = itemTypes.flatMap((t, i) => t.items.map((item) => ({ typeIndex: i, item })))
  const { data: itemRows, error: itemsError } = await supabase
    .from('item')
    .insert(
      itemPlan.map(({ typeIndex, item }, idx) => ({
        item_type_id: itemTypeRows[typeIndex].id,
        label: item.label,
        sort_order: idx,
        blind_label: item.blindLabel,
        // When identity-hiding is on, items must start hidden (not the
        // column's normal default of true) - otherwise every item's real
        // identity would be visible from the moment the event is created,
        // defeating the whole feature. The organizer reveals each one via
        // the existing manual-selection checkbox, same as today.
        include_in_results: !input.hideItemIdentity,
      }))
    )
    .select()
  if (itemsError || !itemRows) {
    await rollback()
    return err('itemInsertFailed')
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
    return err('categoryInsertFailed')
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
    return err('parameterInsertFailed')
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
      return err('criterionInsertFailed')
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
      return err('externalValueInsertFailed')
    }
  }

  // Durable per-visitor lifetime event count (see supabase/migration-014-
  // plans.sql) - deliberately best-effort: this is purely informational
  // for now (no live payment system to actually enforce against), so a
  // failure here must never fail an otherwise-successful event creation.
  try {
    const cookieStore = await cookies()
    let visitorId = cookieStore.get(VISITOR_ID_COOKIE)?.value
    if (!visitorId) {
      visitorId = crypto.randomUUID()
      cookieStore.set(VISITOR_ID_COOKIE, visitorId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: VISITOR_ID_COOKIE_MAX_AGE,
      })
    }
    const { data: existingCount } = await supabase
      .from('visitor_event_count')
      .select('event_count')
      .eq('visitor_id', visitorId)
      .maybeSingle()
    if (existingCount) {
      await supabase
        .from('visitor_event_count')
        .update({ event_count: existingCount.event_count + 1, updated_at: new Date().toISOString() })
        .eq('visitor_id', visitorId)
    } else {
      await supabase.from('visitor_event_count').insert({ visitor_id: visitorId, event_count: 1 })
    }
  } catch {
    // Best-effort, see comment above.
  }

  return {
    eventId: event.id as string,
    shareToken: event.share_token as string,
    hostToken: admin.host_token as string,
    // itemRows is in the exact same order as itemPlan (a single insert
    // call preserves order) - lets the client upload any pending per-item
    // photo files right after creation, matched by clientKey rather than
    // array position (which items got filtered out isn't visible here).
    items: itemRows.map((row, idx) => ({
      itemId: row.id as string,
      clientKey: itemPlan[idx].item.clientKey,
    })),
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

  if (!admin) return err('invalidHostLink')

  const { data: types } = await supabase.from('item_type').select('id').eq('event_id', admin.event_id)
  const typeIds = (types ?? []).map((t) => t.id)

  if (typeIds.length > 0) {
    const { error: itemsError } = await supabase
      .from('item')
      .update({ results_open: true })
      .in('item_type_id', typeIds)
    if (itemsError) return err('openResultsFailed')
  }

  const { error } = await supabase.from('event').update({ results_open: true }).eq('id', admin.event_id)
  if (error) return err('openResultsFailed')
  return { ok: true }
}

export async function openItemResults(hostToken: string, itemId: string) {
  const supabase = createAdminClient()

  const { data: admin } = await supabase
    .from('event_admin')
    .select('event_id')
    .eq('host_token', hostToken)
    .maybeSingle()

  if (!admin) return err('invalidHostLink')

  const { data: item } = await supabase.from('item').select('id, item_type_id').eq('id', itemId).maybeSingle()
  if (!item) return err('itemNotFound')

  const { data: itemType } = await supabase
    .from('item_type')
    .select('event_id')
    .eq('id', item.item_type_id)
    .maybeSingle()

  if (!itemType || itemType.event_id !== admin.event_id) {
    return err('itemNotInEvent')
  }

  const { error } = await supabase.from('item').update({ results_open: true }).eq('id', itemId)
  if (error) return err('openItemResultsFailed')
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

  if (!admin) return err('invalidHostLink')

  const { data: item } = await supabase.from('item').select('id, item_type_id').eq('id', itemId).maybeSingle()
  if (!item) return err('itemNotFound')

  const { data: criterion } = await supabase
    .from('external_criterion')
    .select('id, item_type_id')
    .eq('id', criterionId)
    .maybeSingle()
  if (!criterion || criterion.item_type_id !== item.item_type_id) {
    return err('criterionNotForItem')
  }

  const { data: itemType } = await supabase
    .from('item_type')
    .select('event_id')
    .eq('id', item.item_type_id)
    .maybeSingle()
  if (!itemType || itemType.event_id !== admin.event_id) {
    return err('itemNotInEvent')
  }

  const trimmed = rawValue.trim()
  if (!trimmed) {
    const { error } = await supabase
      .from('item_external_value')
      .delete()
      .eq('item_id', itemId)
      .eq('criterion_id', criterionId)
    if (error) return err('deleteValueFailed')
    return { ok: true }
  }

  const { error } = await supabase
    .from('item_external_value')
    .upsert({ item_id: itemId, criterion_id: criterionId, raw_value: trimmed }, { onConflict: 'item_id,criterion_id' })
  if (error) return err('saveValueFailed')
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
  if (!admin) return err('invalidHostLink')

  const { data: item } = await supabase.from('item').select('id, item_type_id').eq('id', itemId).maybeSingle()
  if (!item) return err('itemNotFound')

  const { data: itemType } = await supabase
    .from('item_type')
    .select('event_id')
    .eq('id', item.item_type_id)
    .maybeSingle()
  if (!itemType || itemType.event_id !== admin.event_id) return err('itemNotInEvent')

  return { ok: true } as const
}

// Organizer-only, set after the event was already created (there's no
// other way to attach these). No OCR/processing of the photo - it's stored
// and shown exactly as uploaded, same as the event logo. Reuses the
// existing public `event-logos` bucket rather than provisioning a new one.
export async function uploadItemPhoto(hostToken: string, itemId: string, formData: FormData) {
  const supabase = createAdminClient()

  const ownership = await verifyHostOwnsItem(supabase, hostToken, itemId)
  if ('errorKey' in ownership) return ownership

  const file = formData.get('file')
  if (!(file instanceof File)) return err('noFileSelected')
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return err('unsupportedFileType')
  }
  if (file.size > MAX_LOGO_BYTES) {
    return err('fileTooLarge')
  }

  const ext = file.name.split('.').pop() || 'png'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('event-logos')
    .upload(path, file, { contentType: file.type })
  if (uploadError) return err('photoUploadFailed')

  const { data } = supabase.storage.from('event-logos').getPublicUrl(path)

  const { error } = await supabase.from('item').update({ image_url: data.publicUrl }).eq('id', itemId)
  if (error) return err('photoSaveFailed')
  return { url: data.publicUrl }
}

export async function removeItemPhoto(hostToken: string, itemId: string) {
  const supabase = createAdminClient()
  const ownership = await verifyHostOwnsItem(supabase, hostToken, itemId)
  if ('errorKey' in ownership) return ownership

  const { error } = await supabase.from('item').update({ image_url: null }).eq('id', itemId)
  if (error) return err('photoRemoveFailed')
  return { ok: true }
}

export async function updateItemLabel(hostToken: string, itemId: string, customLabel: string) {
  const supabase = createAdminClient()
  const ownership = await verifyHostOwnsItem(supabase, hostToken, itemId)
  if ('errorKey' in ownership) return ownership

  const trimmed = customLabel.trim()
  const { error } = await supabase
    .from('item')
    .update({ custom_label: trimmed || null })
    .eq('id', itemId)
  if (error) return err('labelSaveFailed')
  return { ok: true }
}

// Only meaningful when the event's results_reveal_mode is 'manual' - lets
// the organizer pick which items actually appear on the shared results
// screen (e.g. hide the lowest scorers in a sensitive competition). The
// full data stays in the DB either way; this only controls display.
// Hard-deletes the event and everything under it (item_type, item,
// category, parameter, external_criterion, item_external_value,
// participant, score, checklist_answer, event_admin) - the schema's
// on delete cascade chain (event -> item_type/participant -> item/score/
// checklist_answer -> category/... -> parameter, see supabase/schema.sql)
// does the actual cleanup; this action only needs to delete the `event`
// row itself. No extra authorization beyond hostToken - deleting is a
// host-dashboard action same as every other one in this file.
export async function deleteEvent(hostToken: string) {
  const supabase = createAdminClient()
  const { data: admin } = await supabase
    .from('event_admin')
    .select('event_id')
    .eq('host_token', hostToken)
    .maybeSingle()
  if (!admin) return err('invalidHostLink')

  const { error } = await supabase.from('event').delete().eq('id', admin.event_id)
  if (error) return err('deleteEventFailed')
  return { ok: true }
}

// Lets the organizer flip event-level settings from the host dashboard
// AFTER the event was already created and shared - previously the only
// place hide_item_identity could be set was the one-time create-event
// form, with no way back if the organizer got it wrong (e.g. accidentally
// leaving identity revealed for what was meant to be a blind tasting,
// discovered only once the event was already underway). Currently just
// hide_item_identity; add more fields here as more post-creation settings
// need editing rather than adding a parallel action per field.
export async function updateEventSettings(hostToken: string, hideItemIdentity: boolean) {
  const supabase = createAdminClient()
  const { data: admin } = await supabase
    .from('event_admin')
    .select('event_id')
    .eq('host_token', hostToken)
    .maybeSingle()
  if (!admin) return err('invalidHostLink')

  const { error } = await supabase
    .from('event')
    .update({ hide_item_identity: hideItemIdentity })
    .eq('id', admin.event_id)
  if (error) return err('eventSettingsSaveFailed')
  return { ok: true }
}

export async function updateItemVisibility(hostToken: string, itemId: string, includeInResults: boolean) {
  const supabase = createAdminClient()
  const ownership = await verifyHostOwnsItem(supabase, hostToken, itemId)
  if ('errorKey' in ownership) return ownership

  const { error } = await supabase
    .from('item')
    .update({ include_in_results: includeInResults })
    .eq('id', itemId)
  if (error) return err('visibilitySaveFailed')
  return { ok: true }
}

// Lets the organizer remove a single item mid-event (e.g. a mystery item
// nobody could actually identify enough to score, discovered only once
// tasting was already underway) without deleting the whole event. Hard
// delete - on delete cascade takes care of that item's score/
// checklist_answer/item_external_value rows (see supabase/schema.sql).
// Blocks removing the last item of an item type instead of silently
// leaving that type empty (nothing left to rate under it, but the type
// itself - and its categories/parameters - would still exist and confuse
// both the dashboard and any participant screen already open on it);
// deleting the whole item type is the deliberate action for that.
export async function deleteItem(hostToken: string, itemId: string) {
  const supabase = createAdminClient()
  const ownership = await verifyHostOwnsItem(supabase, hostToken, itemId)
  if ('errorKey' in ownership) return ownership

  const { data: item } = await supabase.from('item').select('item_type_id').eq('id', itemId).maybeSingle()
  if (!item) return err('itemNotFound')

  const { count } = await supabase
    .from('item')
    .select('id', { count: 'exact', head: true })
    .eq('item_type_id', item.item_type_id)
  if ((count ?? 0) <= 1) return err('cannotDeleteLastItem')

  const { error } = await supabase.from('item').delete().eq('id', itemId)
  if (error) return err('deleteItemFailed')
  return { ok: true }
}

async function verifyHostOwnsItemType(
  supabase: ReturnType<typeof createAdminClient>,
  hostToken: string,
  itemTypeId: string
) {
  const { data: admin } = await supabase
    .from('event_admin')
    .select('event_id')
    .eq('host_token', hostToken)
    .maybeSingle()
  if (!admin) return err('invalidHostLink')

  const { data: itemType } = await supabase
    .from('item_type')
    .select('id, event_id')
    .eq('id', itemTypeId)
    .maybeSingle()
  if (!itemType || itemType.event_id !== admin.event_id) return err('itemTypeNotInEvent')

  return { ok: true, eventId: admin.event_id } as const
}

// Lets the organizer remove an entire item type (e.g. a whole tasting
// category that fell through, like the cheese course that never showed
// up) mid-event - not just individual items under it. Hard delete - on
// delete cascade takes care of its items (and each item's score/
// checklist_answer/item_external_value), categories (and their
// parameters), and external_criterion rows (see supabase/schema.sql).
// Blocks removing the event's last remaining item type, mirroring
// createEvent's atLeastOneItemType validation - an event with zero item
// types would have nothing left to show participants; deleting the whole
// event is the deliberate action for that.
export async function deleteItemType(hostToken: string, itemTypeId: string) {
  const supabase = createAdminClient()
  const ownership = await verifyHostOwnsItemType(supabase, hostToken, itemTypeId)
  if ('errorKey' in ownership) return ownership

  const { count } = await supabase
    .from('item_type')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', ownership.eventId)
  if ((count ?? 0) <= 1) return err('cannotDeleteLastItemType')

  const { error } = await supabase.from('item_type').delete().eq('id', itemTypeId)
  if (error) return err('deleteItemTypeFailed')
  return { ok: true }
}

async function verifyHostOwnsCategory(
  supabase: ReturnType<typeof createAdminClient>,
  hostToken: string,
  categoryId: string
) {
  const { data: admin } = await supabase
    .from('event_admin')
    .select('event_id')
    .eq('host_token', hostToken)
    .maybeSingle()
  if (!admin) return err('invalidHostLink')

  const { data: category } = await supabase
    .from('category')
    .select('id, item_type_id')
    .eq('id', categoryId)
    .maybeSingle()
  if (!category) return err('categoryNotFound')

  const { data: itemType } = await supabase
    .from('item_type')
    .select('event_id')
    .eq('id', category.item_type_id)
    .maybeSingle()
  if (!itemType || itemType.event_id !== admin.event_id) return err('categoryNotInEvent')

  return { ok: true, itemTypeId: category.item_type_id } as const
}

// Lets the organizer remove a single rating category - a whole group of
// sub-questions, e.g. "Aroma" - mid-event (e.g. a criterion that turned out
// to be unratable for this tasting, or was set up by mistake), without
// touching the item type itself. Hard delete - on delete cascade takes
// care of its parameters (see supabase/schema.sql). Blocks removing an
// item type's last remaining category, mirroring deleteItem/deleteItemType's
// own last-one guards - an item type with zero categories would have
// nothing left to score under it.
export async function deleteCategory(hostToken: string, categoryId: string) {
  const supabase = createAdminClient()
  const ownership = await verifyHostOwnsCategory(supabase, hostToken, categoryId)
  if ('errorKey' in ownership) return ownership

  const { count } = await supabase
    .from('category')
    .select('id', { count: 'exact', head: true })
    .eq('item_type_id', ownership.itemTypeId)
  if ((count ?? 0) <= 1) return err('cannotDeleteLastCategory')

  const { error } = await supabase.from('category').delete().eq('id', categoryId)
  if (error) return err('deleteCategoryFailed')
  return { ok: true }
}

// Shared by setParticipantJudgeWeight (one judge, its own weight) and
// setGroupJudgeWeight (several judges, one shared weight already divided
// evenly by the caller) - both just resolve to "these participants get
// these weights", so the ownership check and the sum-can't-exceed-100
// validation only need writing once. Re-checks the *global* sum across the
// whole event (not just this item/request) so two organizer actions taken
// moments apart can't jointly push the total past 100%.
async function applyJudgeWeights(
  supabase: ReturnType<typeof createAdminClient>,
  hostToken: string,
  updates: { participantId: string; weight: number | null }[]
) {
  const { data: admin } = await supabase
    .from('event_admin')
    .select('event_id')
    .eq('host_token', hostToken)
    .maybeSingle()
  if (!admin) return err('invalidHostLink')

  const { data: participants, error: fetchError } = await supabase
    .from('participant')
    .select('id, judge_weight')
    .eq('event_id', admin.event_id)
  if (fetchError || !participants) return err('judgeWeightSaveFailed')

  const participantIds = new Set(participants.map((p) => p.id))
  for (const u of updates) {
    if (!participantIds.has(u.participantId)) return err('participantNotInEvent')
    if (u.weight !== null && !(u.weight > 0 && u.weight <= 100)) return err('invalidJudgeWeight')
  }

  const updateMap = new Map(updates.map((u) => [u.participantId, u.weight]))
  let total = 0
  for (const p of participants) {
    const w = updateMap.has(p.id) ? (updateMap.get(p.id) as number | null) : p.judge_weight
    if (w !== null && w !== undefined) total += w
  }
  if (total > 100 + 1e-6) return err('judgeWeightExceeds100')

  const results = await Promise.all(
    updates.map((u) => supabase.from('participant').update({ judge_weight: u.weight }).eq('id', u.participantId))
  )
  if (results.some((r) => r.error)) return err('judgeWeightSaveFailed')
  return { ok: true }
}

// Marks (or unmarks, with weight = null) a single participant as a judge
// with their own specific percentage weight.
export async function setParticipantJudgeWeight(hostToken: string, participantId: string, weight: number | null) {
  const supabase = createAdminClient()
  return applyJudgeWeights(supabase, hostToken, [{ participantId, weight }])
}

// Assigns one shared percentage across several participants at once,
// dividing it evenly between them (e.g. 50% / 4 judges = 12.5% each) -
// purely a data-entry convenience; each participant still ends up with
// their own individual judge_weight, same as setParticipantJudgeWeight.
export async function setGroupJudgeWeight(hostToken: string, participantIds: string[], totalWeight: number) {
  if (participantIds.length === 0 || !(totalWeight > 0 && totalWeight <= 100)) {
    return err('invalidJudgeWeight')
  }
  const perParticipant = totalWeight / participantIds.length
  const supabase = createAdminClient()
  return applyJudgeWeights(
    supabase,
    hostToken,
    participantIds.map((participantId) => ({ participantId, weight: perParticipant }))
  )
}

// Free-text feedback from the host dashboard -> the `feedback` table, read
// only from the owner-only /admin panel (src/lib/admin/feedback.ts). No RLS
// policy allows this insert - it goes through here (service role) instead,
// same as every other host-dashboard write in this file.
export async function submitFeedback(hostToken: string, message: string, contact: string, locale: string) {
  const trimmed = message.trim()
  if (!trimmed) return err('feedbackMessageRequired')

  const supabase = createAdminClient()
  const { data: admin } = await supabase
    .from('event_admin')
    .select('event_id')
    .eq('host_token', hostToken)
    .maybeSingle()
  if (!admin) return err('invalidHostLink')

  const { data: event } = await supabase.from('event').select('share_token').eq('id', admin.event_id).maybeSingle()

  const { error } = await supabase.from('feedback').insert({
    event_ref: event?.share_token ?? null,
    message: trimmed,
    contact: contact.trim() || null,
    locale,
  })
  if (error) return err('feedbackSubmitFailed')
  return { ok: true }
}
