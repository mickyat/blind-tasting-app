import type {
  CategoryRow,
  ChecklistAnswerRow,
  ItemRow,
  ItemTypeRow,
  ParameterRow,
  ScoreRow,
} from './types'

export interface ItemResult {
  item: ItemRow
  finalScore: number | null
  participantCount: number
}

// Per item, per participant:
//   1. within each category the participant actually answered anything in,
//      weighted average of its 'scale' sub-question scores:
//      sum(value * parameter.weight) / sum(parameter.weight)
//      (categories/sub-questions never touched simply have no rows in
//      `scores`, so they're naturally excluded from both the numerator and
//      denominator here - partial fill "just works")
//   2. the participant's score for the item is the weighted average of
//      those category scores: sum(category_score * category.weight) / sum(category.weight)
// The item's final score is the average of all participants' scores.
export function calculateResults(
  items: ItemRow[],
  categories: CategoryRow[],
  parameters: ParameterRow[],
  scores: ScoreRow[]
): ItemResult[] {
  const paramById = new Map(parameters.map((p) => [p.id, p]))
  const categoryWeight = new Map(categories.map((c) => [c.id, c.weight]))

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

    const participantScores: number[] = []
    for (const participantScoreRows of byParticipant.values()) {
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

      if (weightSum > 0) participantScores.push(weightedSum / weightSum)
    }

    if (participantScores.length === 0) {
      return { item, finalScore: null, participantCount: 0 }
    }

    const finalScore = participantScores.reduce((a, b) => a + b, 0) / participantScores.length
    return { item, finalScore, participantCount: participantScores.length }
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
