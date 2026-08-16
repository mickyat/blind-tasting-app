import type {
  CategoryRow,
  ChecklistAnswerRow,
  ExternalCriterionRow,
  ItemExternalValueRow,
  ItemRow,
  ItemTypeRow,
  ParameterRow,
  ParticipantRow,
  ScoreRow,
} from './types'

export interface ItemResult {
  item: ItemRow
  finalScore: number | null
  participantCount: number
}

interface WeightedScore {
  weight: number
  score: number
}

// Shared by calculateResults and getItemDetail so both agree on exactly how
// a single participant's score for one item is computed: the weighted
// average of the categories they actually answered anything in, plus the
// item's external criteria folded in at the same weight level (external
// criteria carry the same score for every participant, since the organizer
// sets them once per item, not per participant).
function computeParticipantItemScore(
  categories: CategoryRow[],
  paramById: Map<string, ParameterRow>,
  participantScoreRows: ScoreRow[],
  externalContributions: WeightedScore[]
): number | null {
  const categoryWeight = new Map(categories.map((c) => [c.id, c.weight]))
  const byCategory = new Map<string, ScoreRow[]>()
  for (const s of participantScoreRows) {
    const param = paramById.get(s.parameter_id)
    if (!param) continue
    if (!byCategory.has(param.category_id)) byCategory.set(param.category_id, [])
    byCategory.get(param.category_id)!.push(s)
  }

  let weightedSum = 0
  let weightSum = 0
  for (const [categoryId, rows] of byCategory) {
    let catWeightedSum = 0
    let catWeightSum = 0
    for (const s of rows) {
      const param = paramById.get(s.parameter_id)!
      catWeightedSum += Number(s.value) * param.weight
      catWeightSum += param.weight
    }
    if (catWeightSum <= 0) continue
    const categoryScore = catWeightedSum / catWeightSum
    const catWeight = categoryWeight.get(categoryId) ?? 0
    weightedSum += categoryScore * catWeight
    weightSum += catWeight
  }

  for (const ext of externalContributions) {
    weightedSum += ext.score * ext.weight
    weightSum += ext.weight
  }

  return weightSum > 0 ? weightedSum / weightSum : null
}

function externalContributionsForItem(
  item: ItemRow,
  externalCriteria: ExternalCriterionRow[],
  externalValues: ItemExternalValueRow[]
): WeightedScore[] {
  return externalCriteria
    .filter((c) => c.item_type_id === item.item_type_id)
    .map((c) => {
      const valueRow = externalValues.find((v) => v.item_id === item.id && v.criterion_id === c.id)
      const score = resolveExternalScore(c, valueRow?.raw_value ?? null)
      return score !== null ? { weight: c.weight, score } : null
    })
    .filter((x): x is WeightedScore => x !== null)
}

// Turns an external criterion's raw per-item input into the score it
// contributes, based on its calc_type. Returns null if there's no usable
// value yet (e.g. organizer hasn't filled it in) - the criterion then
// simply doesn't contribute for that item, same "only count what's
// actually provided" rule as everything else in this app.
export function resolveExternalScore(
  criterion: ExternalCriterionRow,
  rawValue: string | null
): number | null {
  if (rawValue === null || rawValue.trim() === '') return null

  if (criterion.calc_type === 'manual') {
    const n = Number(rawValue)
    return Number.isFinite(n) ? n : null
  }

  if (criterion.calc_type === 'threshold') {
    const n = Number(rawValue)
    if (!Number.isFinite(n)) return null
    const thresholds = criterion.config?.thresholds ?? []
    for (const t of thresholds) {
      const matches = t.direction === 'above' ? n >= t.value : n <= t.value
      if (matches) return t.score
    }
    return null
  }

  if (criterion.calc_type === 'options') {
    const opt = (criterion.config?.options ?? []).find((o) => o.label === rawValue)
    return opt ? opt.score : null
  }

  return null
}

// Combines "judge" scores (each carrying their own organizer-assigned
// percentage weight) with "regular" scores, which evenly split whatever
// percentage the judges present for this item didn't claim - e.g. one
// judge at 40% + 5 regulars -> each regular effectively weighs 12%. When
// there are no judges at all, every regular's share is 100/n, which makes
// this reduce to exactly a plain average - so events with no judges score
// identically to before this feature existed.
function weightedFinalScore(judgeScores: WeightedScore[], regularScores: number[]): number {
  const judgeWeightSum = judgeScores.reduce((a, s) => a + s.weight, 0)
  const remaining = Math.max(0, 100 - judgeWeightSum)
  const regularWeightEach = regularScores.length > 0 ? remaining / regularScores.length : 0

  const weightedSum =
    judgeScores.reduce((a, s) => a + s.score * s.weight, 0) +
    regularScores.reduce((a, s) => a + s * regularWeightEach, 0)
  const weightSum = judgeWeightSum + regularWeightEach * regularScores.length

  return weightedSum / weightSum
}

// Per item, per participant:
//   1. within each category the participant actually answered anything in,
//      weighted average of its 'scale' sub-question scores:
//      sum(value * parameter.weight) / sum(parameter.weight)
//      (categories/sub-questions never touched simply have no rows in
//      `scores`, so they're naturally excluded from both the numerator and
//      denominator here - partial fill "just works")
//   2. external criteria (organizer-entered, e.g. price) fold into the same
//      weighted average as the categories, using their own weight
//   3. the participant's score for the item is that combined weighted
//      average
// The item's final score combines every participant's score, weighted per
// weightedFinalScore above (organizer-assigned judge weight if the
// participant has one, otherwise an even split of the leftover).
export function calculateResults(
  items: ItemRow[],
  categories: CategoryRow[],
  parameters: ParameterRow[],
  scores: ScoreRow[],
  externalCriteria: ExternalCriterionRow[] = [],
  externalValues: ItemExternalValueRow[] = [],
  participants: ParticipantRow[] = []
): ItemResult[] {
  const paramById = new Map(parameters.map((p) => [p.id, p]))
  const judgeWeightByParticipant = new Map(participants.map((p) => [p.id, p.judge_weight]))

  const byItem = new Map<string, Map<string, ScoreRow[]>>()
  for (const s of scores) {
    if (!byItem.has(s.item_id)) byItem.set(s.item_id, new Map())
    const byParticipant = byItem.get(s.item_id)!
    if (!byParticipant.has(s.participant_id)) byParticipant.set(s.participant_id, [])
    byParticipant.get(s.participant_id)!.push(s)
  }

  return items.map((item) => {
    const byParticipant = byItem.get(item.id)
    if (!byParticipant || byParticipant.size === 0) {
      return { item, finalScore: null, participantCount: 0 }
    }

    const externalContributions = externalContributionsForItem(item, externalCriteria, externalValues)

    const judgeScores: WeightedScore[] = []
    const regularScores: number[] = []
    for (const [participantId, rows] of byParticipant) {
      const score = computeParticipantItemScore(categories, paramById, rows, externalContributions)
      if (score === null) continue
      const judgeWeight = judgeWeightByParticipant.get(participantId)
      if (judgeWeight !== null && judgeWeight !== undefined) {
        judgeScores.push({ weight: judgeWeight, score })
      } else {
        regularScores.push(score)
      }
    }

    const participantCount = judgeScores.length + regularScores.length
    if (participantCount === 0) {
      return { item, finalScore: null, participantCount: 0 }
    }

    return { item, finalScore: weightedFinalScore(judgeScores, regularScores), participantCount }
  })
}

export function rankResults(results: ItemResult[]): ItemResult[] {
  return [...results].sort((a, b) => {
    if (a.finalScore === null && b.finalScore === null) return 0
    if (a.finalScore === null) return 1
    if (b.finalScore === null) return -1
    return b.finalScore - a.finalScore
  })
}

export interface CategoryAverage {
  category: CategoryRow
  averageScore: number
  participantCount: number
}

export interface ExternalContribution {
  criterion: ExternalCriterionRow
  score: number | null
  rawValue: string | null
}

export interface ParticipantItemScore {
  participant: ParticipantRow
  score: number
}

export interface ItemDetail {
  categoryAverages: CategoryAverage[]
  externalContributions: ExternalContribution[]
  participantScores: ParticipantItemScore[]
  closest: { participant: ParticipantRow; score: number; diff: number } | null
}

// Full breakdown for one item: the crowd's average per category (not
// folding in external criteria - this is purely "what did tasters think"),
// what each external criterion contributed, each participant's own combined
// score, and which participant landed closest to the group's average.
export function getItemDetail(
  item: ItemRow,
  categories: CategoryRow[],
  parameters: ParameterRow[],
  scores: ScoreRow[],
  participants: ParticipantRow[],
  externalCriteria: ExternalCriterionRow[] = [],
  externalValues: ItemExternalValueRow[] = []
): ItemDetail {
  const paramById = new Map(parameters.map((p) => [p.id, p]))
  const itemScores = scores.filter((s) => s.item_id === item.id)

  const byParticipant = new Map<string, ScoreRow[]>()
  for (const s of itemScores) {
    if (!byParticipant.has(s.participant_id)) byParticipant.set(s.participant_id, [])
    byParticipant.get(s.participant_id)!.push(s)
  }

  const itemCategories = categories.filter((c) => c.item_type_id === item.item_type_id)
  const categoryAverages: CategoryAverage[] = []
  for (const cat of itemCategories) {
    const catParamIds = new Set(parameters.filter((p) => p.category_id === cat.id).map((p) => p.id))
    const perParticipant: number[] = []
    for (const rows of byParticipant.values()) {
      const relevant = rows.filter((r) => catParamIds.has(r.parameter_id))
      if (relevant.length === 0) continue
      let ws = 0
      let wsum = 0
      for (const r of relevant) {
        const p = paramById.get(r.parameter_id)!
        ws += Number(r.value) * p.weight
        wsum += p.weight
      }
      if (wsum > 0) perParticipant.push(ws / wsum)
    }
    if (perParticipant.length > 0) {
      categoryAverages.push({
        category: cat,
        averageScore: perParticipant.reduce((a, b) => a + b, 0) / perParticipant.length,
        participantCount: perParticipant.length,
      })
    }
  }

  const itemCriteria = externalCriteria.filter((c) => c.item_type_id === item.item_type_id)
  const externalContributions: ExternalContribution[] = itemCriteria.map((c) => {
    const valueRow = externalValues.find((v) => v.item_id === item.id && v.criterion_id === c.id)
    return {
      criterion: c,
      score: resolveExternalScore(c, valueRow?.raw_value ?? null),
      rawValue: valueRow?.raw_value ?? null,
    }
  })
  const externalForCalc = externalContributions
    .filter((e) => e.score !== null)
    .map((e) => ({ weight: e.criterion.weight, score: e.score as number }))

  const participantScores: ParticipantItemScore[] = []
  for (const participant of participants) {
    const rows = byParticipant.get(participant.id)
    if (!rows || rows.length === 0) continue
    const score = computeParticipantItemScore(categories, paramById, rows, externalForCalc)
    if (score !== null) participantScores.push({ participant, score })
  }

  let closest: ItemDetail['closest'] = null
  if (participantScores.length > 0) {
    const avg = participantScores.reduce((a, b) => a + b.score, 0) / participantScores.length
    let best = participantScores[0]
    let bestDiff = Math.abs(best.score - avg)
    for (const ps of participantScores.slice(1)) {
      const diff = Math.abs(ps.score - avg)
      if (diff < bestDiff) {
        best = ps
        bestDiff = diff
      }
    }
    closest = { participant: best.participant, score: best.score, diff: bestDiff }
  }

  return { categoryAverages, externalContributions, participantScores, closest }
}

// The category physically last in an item type's category list (by
// sort_order) is the one mandatory category - every other category is
// optional. Identified by position, not by name.
export function getLastCategory(itemTypeId: string, categories: CategoryRow[]): CategoryRow | null {
  const forType = categories.filter((c) => c.item_type_id === itemTypeId)
  if (forType.length === 0) return null
  return forType.reduce((last, c) => (c.sort_order > last.sort_order ? c : last))
}

export function answeredKey(participantId: string, itemId: string, parameterId: string) {
  return `${participantId}:${itemId}:${parameterId}`
}

// A single set covering both 'scale' answers (score rows) and 'checklist'
// answers (checklist_answer rows), so completion checks don't care which
// kind a parameter is.
export function buildAnsweredSet(
  scores: ScoreRow[],
  checklistAnswers: ChecklistAnswerRow[]
): Set<string> {
  const set = new Set<string>()
  for (const s of scores) set.add(answeredKey(s.participant_id, s.item_id, s.parameter_id))
  for (const a of checklistAnswers) set.add(answeredKey(a.participant_id, a.item_id, a.parameter_id))
  return set
}

// An item is "done" for a participant once every parameter in its item
// type's last category has an answer - every other category is optional.
export function isItemDone(
  participantId: string,
  item: ItemRow,
  categories: CategoryRow[],
  parameters: ParameterRow[],
  answered: Set<string>
): boolean {
  const lastCategory = getLastCategory(item.item_type_id, categories)
  if (!lastCategory) return false
  const lastCategoryParams = parameters.filter((p) => p.category_id === lastCategory.id)
  if (lastCategoryParams.length === 0) return false
  return lastCategoryParams.every((p) => answered.has(answeredKey(participantId, item.id, p.id)))
}

// The order participants taste items in: grouped by item type in the order
// the organizer defined the item types, then by each item's own order
// within its type. Used for "next item" navigation.
export function orderItemsByType(items: ItemRow[], itemTypes: ItemTypeRow[]): ItemRow[] {
  const typeOrder = new Map(itemTypes.map((t, i) => [t.id, i]))
  return [...items].sort((a, b) => {
    const ta = typeOrder.get(a.item_type_id) ?? 0
    const tb = typeOrder.get(b.item_type_id) ?? 0
    if (ta !== tb) return ta - tb
    return a.sort_order - b.sort_order
  })
}

// The localStorage key a participant's session_token is stored under for a
// given event - shared between ParticipantFlow (sets it on join/restore)
// and ResultsView (reads it to recognize "is the viewer of this results
// page also a participant, and if so which one" for the personal share card).
export function participantSessionKey(eventId: string) {
  return `bt_session_${eventId}`
}
