'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import {
  openResults,
  openItemResults,
  updateExternalValue,
  uploadItemPhoto,
  removeItemPhoto,
  updateItemLabel,
  updateItemVisibility,
  setParticipantJudgeWeight,
  setGroupJudgeWeight,
  deleteEvent,
} from '@/app/actions'
import { buildAnsweredSet, isItemDone } from '@/lib/results'
import { PRIMARY_BUTTON_CLASS } from '@/lib/ui'
import { removeMyEvent } from '@/components/MyEvents'
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

export default function HostDashboard({
  hostToken,
  event,
  items,
  categories,
  parameters,
  externalCriteria,
  externalValues,
}: Props) {
  const t = useTranslations('hostDashboard')
  const tRoot = useTranslations()
  const router = useRouter()
  const visibilityLabels: Record<string, string> = {
    manual: t('visibilityManual'),
    after_all_done: t('visibilityAfterAllDone'),
    live: t('visibilityLive'),
  }
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
    if ('errorKey' in result) {
      setPhotoError((prev) => ({ ...prev, [itemId]: tRoot(`errors.${result.errorKey}`, result.errorParams) }))
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

  const [visibilitySaving, setVisibilitySaving] = useState<Record<string, boolean>>({})

  async function handleToggleVisibility(itemId: string, includeInResults: boolean) {
    setItemsState((prev) => prev.map((i) => (i.id === itemId ? { ...i, include_in_results: includeInResults } : i)))
    setVisibilitySaving((prev) => ({ ...prev, [itemId]: true }))
    await updateItemVisibility(hostToken, itemId, includeInResults)
    setVisibilitySaving((prev) => ({ ...prev, [itemId]: false }))
  }

  // Weighted judges: each participant either has no judge_weight (a
  // "regular", the default) or an organizer-assigned percentage. Editing
  // opens an inline input pre-filled from the participant's current
  // weight; the group flow lets the organizer check off several
  // participants and assign one shared percentage, divided evenly
  // server-side (setGroupJudgeWeight).
  const [judgeSelection, setJudgeSelection] = useState<Set<string>>(new Set())
  const [editingJudgeId, setEditingJudgeId] = useState<string | null>(null)
  const [editingWeightValue, setEditingWeightValue] = useState('')
  const [groupWeightInput, setGroupWeightInput] = useState('')
  const [judgeSaving, setJudgeSaving] = useState<Record<string, boolean>>({})
  const [groupSaving, setGroupSaving] = useState(false)
  const [judgeError, setJudgeError] = useState<string | null>(null)

  function toggleJudgeSelection(participantId: string) {
    setJudgeSelection((prev) => {
      const next = new Set(prev)
      if (next.has(participantId)) next.delete(participantId)
      else next.add(participantId)
      return next
    })
  }

  function startEditingWeight(participant: ParticipantRow) {
    setJudgeError(null)
    setEditingJudgeId(participant.id)
    setEditingWeightValue(participant.judge_weight !== null ? String(participant.judge_weight) : '')
  }

  async function commitSingleWeight(participantId: string) {
    const raw = editingWeightValue.trim()
    const weight = raw ? Number(raw) : null
    if (raw && !(Number.isFinite(weight) && (weight as number) > 0 && (weight as number) <= 100)) {
      setJudgeError(t('judges.invalidWeightHint'))
      return
    }
    setJudgeSaving((prev) => ({ ...prev, [participantId]: true }))
    const result = await setParticipantJudgeWeight(hostToken, participantId, weight)
    setJudgeSaving((prev) => ({ ...prev, [participantId]: false }))
    if ('errorKey' in result) {
      setJudgeError(tRoot(`errors.${result.errorKey}`, result.errorParams))
      return
    }
    setJudgeError(null)
    setEditingJudgeId(null)
    setParticipants((prev) => prev.map((p) => (p.id === participantId ? { ...p, judge_weight: weight } : p)))
  }

  async function clearJudgeWeight(participantId: string) {
    setJudgeSaving((prev) => ({ ...prev, [participantId]: true }))
    const result = await setParticipantJudgeWeight(hostToken, participantId, null)
    setJudgeSaving((prev) => ({ ...prev, [participantId]: false }))
    if ('ok' in result) {
      setParticipants((prev) => prev.map((p) => (p.id === participantId ? { ...p, judge_weight: null } : p)))
    }
  }

  async function applyGroupWeight() {
    setJudgeError(null)
    if (judgeSelection.size === 0) {
      setJudgeError(t('judges.selectAtLeastOneHint'))
      return
    }
    const total = Number(groupWeightInput.trim())
    if (!(Number.isFinite(total) && total > 0 && total <= 100)) {
      setJudgeError(t('judges.invalidWeightHint'))
      return
    }
    const ids = [...judgeSelection]
    setGroupSaving(true)
    const result = await setGroupJudgeWeight(hostToken, ids, total)
    setGroupSaving(false)
    if ('errorKey' in result) {
      setJudgeError(tRoot(`errors.${result.errorKey}`, result.errorParams))
      return
    }
    const perParticipant = total / ids.length
    setParticipants((prev) => prev.map((p) => (judgeSelection.has(p.id) ? { ...p, judge_weight: perParticipant } : p)))
    setJudgeSelection(new Set())
    setGroupWeightInput('')
  }

  const totalJudgeWeight = participants.reduce((sum, p) => sum + (p.judge_weight ?? 0), 0)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDeleteEvent() {
    setDeleting(true)
    const result = await deleteEvent(hostToken)
    if ('errorKey' in result) {
      setDeleting(false)
      setDeleteError(tRoot(`errors.${result.errorKey}`, result.errorParams))
      return
    }
    removeMyEvent(hostToken)
    router.push('/?deleted=1')
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
        const updated = payload.new as { id: string; results_open?: boolean; include_in_results?: boolean }
        setItemsState((prev) =>
          prev.map((i) =>
            i.id === updated.id
              ? { ...i, results_open: Boolean(updated.results_open), include_in_results: Boolean(updated.include_in_results) }
              : i
          )
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

  // Read after mount (not directly at render time) so the server-rendered
  // HTML and the client's first hydration pass agree (both start with an
  // empty origin) - this update then lands as a normal post-hydration
  // re-render instead of a hydration mismatch.
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])
  const shareLink = `${origin}/e/${event.share_token}`
  const resultsLink = `${origin}/e/${event.share_token}/results`

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

  // The `qrcode` library sets the canvas's *inline* style.width/height to
  // match whatever `width` option it's given (lib/renderer/canvas.js) -
  // that inline style silently wins over any Tailwind size class, which is
  // exactly what made the on-screen QR render at a full 1024px "print"
  // size on real phones and overlap the copy button next to it. Fix: never
  // render the print-resolution QR into the visible canvas at all - the
  // screen canvas only ever renders at QR_DISPLAY_SIZE, and the downloads
  // generate their own high-res image independently via QRCode.toDataURL/
  // toString (which create their own offscreen canvas, untouched by this
  // one) instead of reading pixels back out of the small visible canvas.
  const QR_DISPLAY_SIZE = 176
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!origin || !qrCanvasRef.current) return
    QRCode.toCanvas(qrCanvasRef.current, shareLink, { width: QR_DISPLAY_SIZE, margin: 1 }).catch(() => {})
  }, [origin, shareLink])

  async function downloadQrPng() {
    const dataUrl = await QRCode.toDataURL(shareLink, { width: 1024, margin: 1 })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${event.title || 'event'}-qr.png`
    a.click()
  }

  async function downloadQrSvg() {
    const svg = await QRCode.toString(shareLink, { type: 'svg', width: 1024, margin: 1 })
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title || 'event'}-qr.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-4">
        <span className="text-xs font-medium text-zinc-500">{t('shareLinkLabel')}</span>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs text-zinc-700">
            {shareLink}
          </code>
          <button
            onClick={() => copy(shareLink, 'share')}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium"
          >
            {copied === 'share' ? t('copied') : t('copy')}
          </button>
        </div>
        <div className="flex flex-col items-center gap-2 border-t border-zinc-200 pt-3">
          <span className="text-xs text-zinc-500">{t('qr.hint')}</span>
          <canvas ref={qrCanvasRef} className="max-w-full rounded-lg border border-zinc-200" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={downloadQrPng}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700"
            >
              {t('qr.downloadPng')}
            </button>
            <button
              type="button"
              onClick={downloadQrSvg}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700"
            >
              {t('qr.downloadSvg')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-4">
        <span className="text-xs font-medium text-zinc-500">{t('resultsLinkLabel')}</span>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs text-zinc-700">
            {resultsLink}
          </code>
          <button
            onClick={() => copy(resultsLink, 'results')}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium"
          >
            {copied === 'results' ? t('copied') : t('copy')}
          </button>
        </div>
        <a
          href={`/e/${event.share_token}/results`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-center text-xs font-semibold text-zinc-700"
        >
          {t('goToResults')}
        </a>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700">
          {t('participantsHeading', { count: participants.length })}
        </h2>
        {participants.length === 0 ? (
          <p className="text-sm text-zinc-400">{t('noParticipantsYet')}</p>
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
                        {isDone ? t('done') : t('pending', { done: doneItems.length, total: itemsState.length })}
                      </span>
                      {!isDone && (
                        <button
                          type="button"
                          onClick={() => sendReminder(p.id)}
                          className="shrink-0 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600"
                        >
                          {reminded[p.id] ? t('reminderSent') : t('sendReminder')}
                        </button>
                      )}
                    </div>
                  </div>
                  {!isDone && pendingItems.length > 0 && (
                    <span className="text-xs text-zinc-400">
                      {t('missing', { items: pendingItems.map((i) => i.label).join(', ') })}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {participants.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-zinc-700">{t('judges.heading')}</h2>
            <p className="text-xs text-zinc-400">{t('judges.hint')}</p>
            <p className="text-xs text-zinc-500">{t('judges.totalAssigned', { total: totalJudgeWeight })}</p>
          </div>

          <ul className="flex flex-col gap-1.5">
            {participants.map((p) => {
              const isEditing = editingJudgeId === p.id
              return (
                <li key={p.id} className="flex flex-col gap-2 rounded-lg border border-zinc-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={judgeSelection.has(p.id)}
                      onChange={() => toggleJudgeSelection(p.id)}
                    />
                    {p.nickname}
                    {p.judge_weight !== null && !isEditing && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        {t('judges.weightBadge', { weight: p.judge_weight })}
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="any"
                          autoFocus
                          value={editingWeightValue}
                          onChange={(e) => setEditingWeightValue(e.target.value)}
                          className="w-20 rounded-lg border border-zinc-300 px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => commitSingleWeight(p.id)}
                          disabled={judgeSaving[p.id]}
                          className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 disabled:opacity-50"
                        >
                          {t('judges.save')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingJudgeId(null)}
                          className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-500"
                        >
                          {t('judges.cancel')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditingWeight(p)}
                          className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700"
                        >
                          {p.judge_weight !== null ? t('judges.editWeight') : t('judges.markAsJudge')}
                        </button>
                        {p.judge_weight !== null && (
                          <button
                            type="button"
                            onClick={() => clearJudgeWeight(p.id)}
                            disabled={judgeSaving[p.id]}
                            className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-500 disabled:opacity-50"
                          >
                            {t('judges.clear')}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-zinc-300 p-3">
            <span className="text-xs text-zinc-500">{t('judges.groupHint')}</span>
            <input
              type="number"
              min={0}
              max={100}
              step="any"
              value={groupWeightInput}
              onChange={(e) => setGroupWeightInput(e.target.value)}
              placeholder={t('judges.groupWeightPlaceholder')}
              className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={applyGroupWeight}
              disabled={groupSaving}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 disabled:opacity-50"
            >
              {groupSaving ? t('judges.applying') : t('judges.applyToSelected', { count: judgeSelection.size })}
            </button>
          </div>

          {judgeError && <p className="text-xs text-red-600">{judgeError}</p>}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700">{t('itemMediaHeading')}</h2>
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
                    {t('removePhoto')}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <label
                    className={`cursor-pointer rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 ${photoUploading[item.id] ? 'pointer-events-none opacity-50' : ''}`}
                  >
                    {t('takePhoto')}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoChange(item.id, e)}
                      disabled={photoUploading[item.id]}
                      className="hidden"
                    />
                  </label>
                  <label
                    className={`cursor-pointer rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 ${photoUploading[item.id] ? 'pointer-events-none opacity-50' : ''}`}
                  >
                    {t('chooseFromGallery')}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => handlePhotoChange(item.id, e)}
                      disabled={photoUploading[item.id]}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
              {photoUploading[item.id] && <span className="text-xs text-zinc-400">{t('uploadingPhoto')}</span>}
            </div>
            {photoError[item.id] && <p className="text-xs text-red-600">{photoError[item.id]}</p>}
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                {t('customLabelCaption')}
                {labelSaving[item.id] && <span className="text-zinc-400">{t('saving')}</span>}
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
          <h2 className="text-sm font-medium text-zinc-700">{t('externalCriteriaHeading')}</h2>
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
                          {externalSaving[key] && <span className="text-zinc-400">{t('saving')}</span>}
                          {externalSaved[key] && <span className="text-green-600">{t('saved')}</span>}
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
          {t('visibilityLabel', { mode: visibilityLabels[event.results_visibility] })}
        </span>

        {event.results_visibility === 'manual' && (
          <>
            <button onClick={handleOpenResults} disabled={opening} className={PRIMARY_BUTTON_CLASS}>
              {opening ? t('openingAll') : t('openAllResults')}
            </button>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-500">{t('perItemPublishHeading')}</span>
              <ul className="flex flex-col gap-1.5">
                {itemsState.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2"
                  >
                    <span className="text-sm">{item.label}</span>
                    {item.results_open ? (
                      <span className="text-xs font-medium text-green-600">{t('published')}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenItemResults(item.id)}
                        disabled={openingItemId === item.id}
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 disabled:opacity-50"
                      >
                        {openingItemId === item.id ? t('publishing') : t('publish')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {event.results_visibility !== 'manual' && (
          <p className="text-xs text-zinc-500">{t('autoRevealHint')}</p>
        )}
      </div>

      {event.results_reveal_mode === 'manual' && (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4">
          <span className="text-xs font-medium text-zinc-500">{t('revealMode.manualHeading')}</span>
          {scores.length === 0 ? (
            <p className="text-xs text-zinc-500">{t('revealMode.noScoresYet')}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {itemsState.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2"
                >
                  <span className="text-sm">{item.custom_label ? `${item.label} — ${item.custom_label}` : item.label}</span>
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                    {visibilitySaving[item.id] && <span className="text-zinc-400">{t('saving')}</span>}
                    <input
                      type="checkbox"
                      checked={item.include_in_results}
                      onChange={(e) => handleToggleVisibility(item.id, e.target.checked)}
                    />
                    {t('revealMode.showInResults')}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border-2 border-red-300 bg-red-50 p-4">
        <h2 className="text-sm font-bold text-red-700">{t('dangerZone.heading')}</h2>
        <p className="text-xs text-red-600">{t('dangerZone.hint')}</p>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="self-start rounded-lg border-2 border-red-400 bg-white px-4 py-2 text-sm font-semibold text-red-700"
        >
          {t('dangerZone.deleteButton')}
        </button>
        {deleteError && <p className="text-xs text-red-700">{deleteError}</p>}
      </div>

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border-2 border-red-400 bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-red-700">
              {t('dangerZone.confirmTitle', { title: event.title })}
            </h3>
            <p className="text-sm text-zinc-600">{t('dangerZone.confirmBody')}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50"
              >
                {t('dangerZone.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteEvent}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {deleting ? t('dangerZone.deleting') : t('dangerZone.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
