import type { ItemRow, ParameterRow, ScoreRow } from './types'

export interface ItemResult {
  item: ItemRow
  finalScore: number | null
  participantCount: number
}

// Per item: for each participant, weighted average of their scores across
// parameters (sum(value*weight)/sum(weight)); the item's final score is the
// average of those per-participant weighted averages.
export function calculateResults(
  items: ItemRow[],
  parameters: ParameterRow[],
  scores: ScoreRow[]
): ItemResult[] {
  const weightByParam = new Map(parameters.map((p) => [p.id, p.weight]))

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

    const participantAverages: number[] = []
    for (const participantScores of byParticipant.values()) {
      let weightedSum = 0
      let weightSum = 0
      for (const s of participantScores) {
        const w = weightByParam.get(s.parameter_id)
        if (w === undefined) continue
        weightedSum += Number(s.value) * w
        weightSum += w
      }
      if (weightSum > 0) participantAverages.push(weightedSum / weightSum)
    }

    if (participantAverages.length === 0) {
      return { item, finalScore: null, participantCount: 0 }
    }

    const finalScore = participantAverages.reduce((a, b) => a + b, 0) / participantAverages.length
    return { item, finalScore, participantCount: participantAverages.length }
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
