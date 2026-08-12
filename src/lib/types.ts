export type ResultsVisibility = 'manual' | 'after_all_done' | 'live'
export type EventTheme = 'default' | 'wine' | 'meat' | 'beer' | 'coffee'
export type ParameterKind = 'scale' | 'checklist'

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

export interface ItemTypeRow {
  id: string
  event_id: string
  name: string
  template: string | null
  sort_order: number
}

export interface ItemRow {
  id: string
  item_type_id: string
  label: string
  sort_order: number
  results_open: boolean
}

export interface CategoryRow {
  id: string
  item_type_id: string
  name: string
  weight: number
  sort_order: number
}

export interface ParameterRow {
  id: string
  category_id: string
  name: string
  weight: number
  kind: ParameterKind
  scale_min: number | null
  scale_max: number | null
  options: string[] | null
  multi_select: boolean
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

export interface ChecklistAnswerRow {
  id: string
  participant_id: string
  item_id: string
  parameter_id: string
  option: string
}
