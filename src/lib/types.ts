export type ResultsVisibility = 'manual' | 'after_all_done' | 'live'
export type EventTheme =
  | 'default'
  | 'wine'
  | 'meat'
  | 'beer'
  | 'coffee'
  | 'whiskey'
  | 'cheese'
  | 'sausage'
  | 'burger'
  | 'pizza'
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
  image_url: string | null
  custom_label: string | null
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

export type ExternalCriterionCalcType = 'manual' | 'threshold' | 'options'

export type ThresholdDirection = 'below' | 'above'

export interface ThresholdRule {
  direction: ThresholdDirection
  value: number
  score: number
}

export interface OptionRule {
  label: string
  score: number
}

export interface ExternalCriterionConfig {
  thresholds?: ThresholdRule[]
  options?: OptionRule[]
}

export interface ExternalCriterionRow {
  id: string
  item_type_id: string
  name: string
  weight: number
  calc_type: ExternalCriterionCalcType
  config: ExternalCriterionConfig | null
  sort_order: number
}

export interface ItemExternalValueRow {
  id: string
  item_id: string
  criterion_id: string
  raw_value: string | null
}
