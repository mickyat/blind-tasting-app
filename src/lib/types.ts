export type ResultsVisibility = 'manual' | 'after_all_done' | 'live'
export type EventTheme = 'default' | 'wine' | 'meat' | 'beer' | 'coffee'

export interface EventRow {
  id: string
  title: string
  share_token: string
  results_visibility: ResultsVisibility
  results_open: boolean
  theme: EventTheme
  logo_url: string | null
  created_at: string
}

export interface ItemRow {
  id: string
  event_id: string
  label: string
  sort_order: number
}

export interface CategoryRow {
  id: string
  event_id: string
  name: string
  weight: number
  sort_order: number
}

export interface ParameterRow {
  id: string
  category_id: string
  name: string
  weight: number
  scale_min: number
  scale_max: number
  sort_order: number
}

export interface ParticipantRow {
  id: string
  event_id: string
  nickname: string
  session_token: string
  created_at: string
}

export interface ScoreRow {
  id: string
  participant_id: string
  item_id: string
  parameter_id: string
  value: number
}
