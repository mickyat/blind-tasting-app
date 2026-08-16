'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { THEME_STYLES } from '@/lib/theme'
import { PRIMARY_BUTTON_CLASS } from '@/lib/ui'
import OrganizerOrParticipantLink from '@/components/OrganizerOrParticipantLink'
import ShareCardButton from '@/components/ShareCardButton'
import {
  buildAnsweredSet,
  calculateResults,
  getItemDetail,
  isItemDone,
  participantSessionKey,
  rankResults,
  type ItemDetail,
  type ItemResult,
} from '@/lib/results'
import type {
  CategoryRow,
  ChecklistAnswerRow,
  EventRow,
  ExternalCriterionRow,
  ItemExternalValueRow,
  ItemRow,
  ItemTypeRow,
  ParameterRow,
  ParticipantRow,
  ScoreRow,
} from '@/lib/types'

// Full results always stay in the DB - this only trims what the
// public/shared screen renders, per the organizer's results_reveal_mode.
// Slicing/filtering *before* handing the array to RankingList also makes the
// displayed #1/#2/#3 numbering naturally match the visible set, so hidden
// items' true positions are never implied.
function applyRevealMode(ranked: ItemResult[], mode: EventRow['results_reveal_mode']): ItemResult[] {
  if (mode === 'top1') return ranked.slice(0, 1)
  if (mode === 'top3') return ranked.slice(0, 3)
  if (mode === 'manual') return ranked.filter((r) => r.item.include_in_results)
  return ranked
}

interface Props {
  event: EventRow
  itemTypes: ItemTypeRow[]
  items: ItemRow[]
  categories: CategoryRow[]
  parameters: ParameterRow[]
  externalCriteria: ExternalCriterionRow[]
  externalValues: ItemExternalValueRow[]
}

export default function ResultsView({
  event,
  itemTypes,
  items,
  categories,
  parameters,
  externalCriteria,
  externalValues,
}: Props) {
  const t = useTranslations('resultsView')
  const [supabase] = useState(() => createClient())
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [checklistAnswers, setChecklistAnswers] = useState<ChecklistAnswerRow[]>([])
  const [itemsState, setItemsState] = useState<ItemRow[]>(items)
  const [includeExternal, setIncludeExternal] = useState(true)
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem(participantSessionKey(event.id))
    if (!token) return
    const mine = participants.find((p) => p.session_token === token)
    if (mine) setMyParticipantId(mine.id)
  }, [event.id, participants])

  const refresh = useCallback(async () => {
    const { data: parts } = await supabase.from('participant').select('*').eq('event_id', event.id)
    setParticipants(parts ?? [])

    const itemIds = items.map((i) => i.id)
    if (itemIds.length > 0) {
      const [{ data: sc }, { data: ca }] = await Promise.all([
        supabase.from('score').select('*').in('item_id', itemIds),
        supabase.from('checklist_answer').select('*').in('item_id', itemIds),
      ])
      setScores(sc ?? [])
      setChecklistAnswers(ca ?? [])
    }
  }, [supabase, event.id, items])

  useEffect(() => {
    refresh()
    const channel = supabase
      .channel(`results-${event.id}`)
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

  const isItemOpen = useCallback(
    (item: ItemRow) => {
      if (event.results_visibility === 'live') return true
      if (event.results_visibility === 'after_all_done') {
        return participants.length > 0 && participants.every((p) => isItemDone(p.id, item, categories, parameters, answered))
      }
      return item.results_open
    },
    [event.results_visibility, participants, categories, parameters, answered]
  )

  const openItems = itemsState.filter(isItemOpen)
  const pendingItems = itemsState.filter((i) => !isItemOpen(i))
  const theme = THEME_STYLES[event.theme]

  if (openItems.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
        {event.results_visibility === 'after_all_done' ? (
          <p className={`text-base font-medium ${theme.accent}`}>{t('waitingAfterAllDone')}</p>
        ) : (
          <p className={`text-base font-medium ${theme.accent}`}>{t('waitingManual')}</p>
        )}
        <OrganizerOrParticipantLink eventId={event.id} mutedClass={theme.muted} waiting />
      </div>
    )
  }

  const activeCriteria = includeExternal ? externalCriteria : []
  const activeValues = includeExternal ? externalValues : []

  const overallRanked = rankResults(
    calculateResults(openItems, categories, parameters, scores, activeCriteria, activeValues)
  )
  const visibleOverallRanked = applyRevealMode(overallRanked, event.results_reveal_mode)
  const hasMultipleTypes = itemTypes.length > 1

  const itemDetails = new Map(
    openItems.map((item) => [
      item.id,
      getItemDetail(item, categories, parameters, scores, participants, activeCriteria, activeValues),
    ])
  )

  const winnerResult = visibleOverallRanked.find((r) => r.finalScore !== null)
  const winnerDetail = winnerResult ? itemDetails.get(winnerResult.item.id) : undefined
  const myWinnerScore = winnerDetail?.participantScores.find((ps) => ps.participant.id === myParticipantId)
  const amIClosestForWinner = winnerDetail?.closest?.participant.id === myParticipantId

  return (
    <div className="flex flex-col gap-8">
      {externalCriteria.length > 0 && (
        <div className="flex gap-2 rounded-xl border border-white/20 p-1">
          {(
            [
              { value: true, label: t('withExternal') },
              { value: false, label: t('withoutExternal') },
            ] as { value: boolean; label: string }[]
          ).map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setIncludeExternal(opt.value)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${
                includeExternal === opt.value ? 'bg-white text-zinc-900' : `${theme.muted}`
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {winnerResult && winnerResult.finalScore !== null && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/20 p-4">
          {event.prize_description && (
            <p className={`text-center text-sm font-medium ${theme.accent}`}>
              {t('prizeAnnouncement', { prize: event.prize_description })}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <ShareCardButton
              type="winner"
              theme={event.theme}
              eventTitle={event.title}
              itemName={itemDisplayName(winnerResult.item)}
              itemImageUrl={winnerResult.item.image_url}
              score={winnerResult.finalScore.toFixed(2)}
              prizeDescription={event.prize_description}
            />
            {myWinnerScore && (
              <ShareCardButton
                type="participant"
                theme={event.theme}
                eventTitle={event.title}
                itemName={itemDisplayName(winnerResult.item)}
                itemImageUrl={winnerResult.item.image_url}
                score={winnerResult.finalScore.toFixed(2)}
                nickname={participants.find((p) => p.id === myParticipantId)?.nickname ?? ''}
                participantScore={myWinnerScore.score.toFixed(2)}
                isClosest={amIClosestForWinner}
              />
            )}
          </div>
          <a href="/" className={`mt-1 text-center ${PRIMARY_BUTTON_CLASS}`}>
            {t('createNextEvent')}
          </a>
        </div>
      )}

      <RankingList
        title={hasMultipleTypes ? t('overallRanking') : undefined}
        results={visibleOverallRanked}
        itemDetails={itemDetails}
        theme={theme}
      />

      {hasMultipleTypes &&
        itemTypes.map((itemType) => {
          const typeItems = openItems.filter((i) => i.item_type_id === itemType.id)
          if (typeItems.length === 0) return null
          const typeRanked = rankResults(
            calculateResults(typeItems, categories, parameters, scores, activeCriteria, activeValues)
          )
          const visibleTypeRanked = applyRevealMode(typeRanked, event.results_reveal_mode)
          if (visibleTypeRanked.length === 0) return null
          return (
            <RankingList
              key={itemType.id}
              title={t('typeRanking', { name: itemType.name })}
              results={visibleTypeRanked}
              itemDetails={itemDetails}
              theme={theme}
            />
          )
        })}

      {pendingItems.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-white/30 p-4">
          <span className={`text-xs font-medium ${theme.accent}`}>{t('notYetPublished')}</span>
          <span className={`text-sm ${theme.muted}`}>
            {pendingItems.map((i) => (i.custom_label ? `${i.label} — ${i.custom_label}` : i.label)).join(', ')}
          </span>
        </div>
      )}

      <DescriptiveSummary
        items={openItems.filter((i) => visibleOverallRanked.some((r) => r.item.id === i.id))}
        categories={categories}
        parameters={parameters}
        checklistAnswers={checklistAnswers}
        participantCount={participants.length}
        theme={theme}
      />

      <OrganizerOrParticipantLink eventId={event.id} mutedClass={theme.muted} />
    </div>
  )
}

// Plain-string version of ItemIdentity below, for contexts that can't take
// JSX (e.g. the share-card image, built from URL query params).
function itemDisplayName(item: ItemRow): string {
  return item.custom_label ? `${item.label} — ${item.custom_label}` : item.label
}

// The organizer sets these post-creation (host dashboard, §4) once judging
// is over - the item's `label` itself stays whatever anonymous tag the
// organizer used to keep tasting blind (e.g. "פריט 1"), so this shows the
// revealed real identity alongside it rather than replacing it outright.
function ItemIdentity({ item }: { item: ItemRow }) {
  if (!item.image_url && !item.custom_label) return <>{item.label}</>
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      {item.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image_url} alt="" className="h-8 w-8 rounded-md border border-zinc-200 object-cover" />
      )}
      <span>
        {item.label}
        {item.custom_label && <span className="text-zinc-500"> — {item.custom_label}</span>}
      </span>
    </span>
  )
}

function RankingList({
  title,
  results,
  itemDetails,
  theme,
}: {
  title?: string
  results: ItemResult[]
  itemDetails: Map<string, ItemDetail>
  theme: (typeof THEME_STYLES)[keyof typeof THEME_STYLES]
}) {
  const t = useTranslations('resultsView')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const maxScore = Math.max(1e-9, ...results.map((r) => r.finalScore ?? 0))

  return (
    <div className="flex flex-col gap-3">
      {title && <h2 className={`text-sm font-semibold ${theme.accent}`}>{title}</h2>}
      {results.map((r, i) => {
        const detail = itemDetails.get(r.item.id)
        const hasDetail =
          detail &&
          (detail.categoryAverages.length > 0 ||
            detail.externalContributions.length > 0 ||
            detail.participantScores.length > 0)
        const isOpen = expanded.has(r.item.id)
        const barPercent = r.finalScore !== null ? Math.max(4, (r.finalScore / maxScore) * 100) : 0
        return (
          <div
            key={r.item.id}
            className={`relative rounded-xl border p-4 ${
              i === 0 ? 'animate-winner-glow border-amber-400 bg-amber-50' : 'border-zinc-300 bg-white'
            }`}
          >
            {i === 0 && (
              <>
                <span className="animate-sparkle absolute -top-1 right-6 text-sm" style={{ animationDelay: '0s' }}>
                  ✨
                </span>
                <span
                  className="animate-sparkle absolute -top-1 right-14 text-xs"
                  style={{ animationDelay: '0.6s' }}
                >
                  ✨
                </span>
                <span
                  className="animate-sparkle absolute -top-1 right-20 text-sm"
                  style={{ animationDelay: '1.2s' }}
                >
                  ✨
                </span>
              </>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-zinc-400">#{i + 1}</span>
                <div className="flex flex-col">
                  <span className="text-base font-semibold text-zinc-900">
                    {i === 0 && '🏆 '}
                    <ItemIdentity item={r.item} />
                  </span>
                  {r.participantCount > 0 && (
                    <span className="text-xs text-zinc-500">{t('ratingsCount', { count: r.participantCount })}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-zinc-900">
                  {r.finalScore !== null ? r.finalScore.toFixed(2) : '—'}
                </span>
                {hasDetail && (
                  <button
                    type="button"
                    onClick={() => toggle(r.item.id)}
                    className="shrink-0 text-xs font-medium text-zinc-500 underline"
                  >
                    {isOpen ? t('hideDetail') : t('showDetail')}
                  </button>
                )}
              </div>
            </div>
            {r.finalScore !== null && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full ${i === 0 ? 'bg-amber-400' : 'bg-zinc-400'}`}
                  style={{ width: `${barPercent}%` }}
                />
              </div>
            )}
            {isOpen && detail && <ItemDetailView detail={detail} />}
          </div>
        )
      })}
    </div>
  )
}

function ItemDetailView({ detail }: { detail: ItemDetail }) {
  const t = useTranslations('resultsView')
  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-zinc-200 pt-3">
      {detail.categoryAverages.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">{t('categoryAverageHeading')}</span>
          <ul className="flex flex-col gap-0.5">
            {detail.categoryAverages.map((ca) => (
              <li key={ca.category.id} className="flex items-center justify-between text-sm">
                <span className="text-zinc-700">
                  {ca.category.name}{' '}
                  <span className="text-xs text-zinc-400">{t('weightSuffix', { weight: ca.category.weight })}</span>
                </span>
                <span className="font-medium text-zinc-900">{ca.averageScore.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail.externalContributions.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">{t('externalCriteriaHeading')}</span>
          <ul className="flex flex-col gap-0.5">
            {detail.externalContributions.map((ec) => (
              <li key={ec.criterion.id} className="flex items-center justify-between text-sm">
                <span className="text-zinc-700">
                  {ec.criterion.name}{' '}
                  <span className="text-xs text-zinc-400">
                    {ec.rawValue
                      ? t('criterionWeightWithValue', { weight: ec.criterion.weight, value: ec.rawValue })
                      : t('weightSuffix', { weight: ec.criterion.weight })}
                  </span>
                </span>
                <span className="font-medium text-zinc-900">{ec.score !== null ? ec.score.toFixed(2) : '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail.participantScores.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">{t('participantScoreHeading')}</span>
          <ul className="flex flex-col gap-0.5">
            {detail.participantScores.map((ps) => (
              <li key={ps.participant.id} className="flex items-center justify-between text-sm">
                <span className="text-zinc-700">
                  {ps.participant.nickname}
                  {detail.closest?.participant.id === ps.participant.id && (
                    <span className="mr-1 text-amber-500" title={t('closestTooltip')}>
                      ⭐
                    </span>
                  )}
                </span>
                <span className="font-medium text-zinc-900">{ps.score.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail.closest && (
        <p className="text-xs text-zinc-500">
          {t('closestLine')}{' '}
          <span className="font-medium text-zinc-700">{detail.closest.participant.nickname}</span> (
          {detail.closest.score.toFixed(2)})
        </p>
      )}
    </div>
  )
}

function DescriptiveSummary({
  items,
  categories,
  parameters,
  checklistAnswers,
  participantCount,
  theme,
}: {
  items: ItemRow[]
  categories: CategoryRow[]
  parameters: ParameterRow[]
  checklistAnswers: ChecklistAnswerRow[]
  participantCount: number
  theme: (typeof THEME_STYLES)[keyof typeof THEME_STYLES]
}) {
  const t = useTranslations('resultsView')
  const checklistParams = parameters.filter((p) => p.kind === 'checklist')
  if (checklistParams.length === 0 || participantCount === 0) return null

  const categoryById = new Map(categories.map((c) => [c.id, c]))

  return (
    <div className="flex flex-col gap-4">
      <h2 className={`text-sm font-semibold ${theme.accent}`}>{t('descriptiveSummary')}</h2>
      {items.map((item) => {
        const itemParams = checklistParams.filter(
          (p) => categoryById.get(p.category_id)?.item_type_id === item.item_type_id
        )
        if (itemParams.length === 0) return null

        return (
          <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-800">
              <ItemIdentity item={item} />
            </h3>
            {itemParams.map((param) => {
              const counts = new Map<string, number>()
              for (const opt of param.options ?? []) counts.set(opt, 0)
              for (const a of checklistAnswers) {
                if (a.parameter_id !== param.id || a.item_id !== item.id) continue
                counts.set(a.option, (counts.get(a.option) ?? 0) + 1)
              }
              return (
                <div key={param.id} className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-zinc-500">{param.name}</span>
                  <ul className="flex flex-col gap-0.5">
                    {[...counts.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([option, count]) => (
                        <li key={option} className="flex items-center justify-between text-sm">
                          <span className="text-zinc-700">{option}</span>
                          <span className="text-zinc-500">
                            {t('selectedBy', { count, total: participantCount })}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
