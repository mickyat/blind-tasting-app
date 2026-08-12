import type { EventTheme } from './types'

interface TemplateParameter {
  name: string
  weight: number
  scaleMin: number
  scaleMax: number
}

interface TemplateCategory {
  name: string
  weight: number
  parameters: TemplateParameter[]
}

export interface EventTemplate {
  id: EventTheme
  label: string
  categories: TemplateCategory[]
}

function q(name: string): TemplateParameter {
  return { name, weight: 1, scaleMin: 1, scaleMax: 5 }
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: 'wine',
    label: 'יין',
    categories: [
      { name: 'מראה', weight: 1, parameters: [q('צבע'), q('צלילות')] },
      { name: 'אף', weight: 1, parameters: [q('פגם'), q('עוצמה'), q('מורכבות')] },
      { name: 'פה', weight: 1, parameters: [q('חמיצות'), q('עפיצות'), q('איזון'), q('אורך')] },
      { name: 'כללי', weight: 1, parameters: [q('ייחודיות'), q('איזון כללי'), q('רצון לשוב אליו')] },
    ],
  },
  {
    id: 'meat',
    label: 'בשר',
    categories: [
      { name: 'מרקם', weight: 1, parameters: [q('רכות'), q('עסיסיות')] },
      { name: 'טעם', weight: 1, parameters: [q('עוצמת טעם'), q('תיבול')] },
      { name: 'כללי', weight: 1, parameters: [q('איכות בישול'), q('מחיר לק"ג')] },
    ],
  },
  {
    id: 'beer',
    label: 'בירה',
    categories: [
      { name: 'מראה', weight: 1, parameters: [q('צבע'), q('קצף')] },
      { name: 'ריח', weight: 1, parameters: [q('עוצמה'), q('ניחוחות')] },
      { name: 'טעם', weight: 1, parameters: [q('מרירות'), q('מתיקות'), q('גוף')] },
      { name: 'כללי', weight: 1, parameters: [q('רעננות'), q('איזון')] },
    ],
  },
  {
    id: 'coffee',
    label: 'קפה',
    categories: [
      { name: 'ריח', weight: 1, parameters: [q('עוצמה'), q('ניחוחות')] },
      { name: 'טעם', weight: 1, parameters: [q('חמיצות'), q('מרירות'), q('גוף')] },
      { name: 'כללי', weight: 1, parameters: [q('איזון'), q('רצון לשוב אליו')] },
    ],
  },
]
