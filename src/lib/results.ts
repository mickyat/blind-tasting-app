import type { CategoryRow, ItemRow, ParameterRow, ScoreRow } from './types'

export interface ItemResult {
  item: ItemRow
  finalScore: number | null
  participantCount: number
}

// Per item, per participant:
//   1. within each category, weighted average of its sub-question scores:
//      sum(value * parameter.weight) / sum(parameter.weight)
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
