interface ScaleParameter {
  kind: 'scale'
  name: string
  weight: number
  scaleMin: number
  scaleMax: number
}

interface ChecklistParameter {
  kind: 'checklist'
  name: string
  weight: number
  options: string[]
  multiSelect: boolean
}

export type TemplateParameter = ScaleParameter | ChecklistParameter

interface TemplateCategory {
  name: string
  weight: number
  parameters: TemplateParameter[]
}

export interface EventTemplate {
  id: string
  label: string
  categories: TemplateCategory[]
}

function q(name: string, weight = 1): ScaleParameter {
  return { kind: 'scale', name, weight, scaleMin: 1, scaleMax: 5 }
}

function single(name: string, options: string[], weight = 1): ChecklistParameter {
  return { kind: 'checklist', name, weight, options, multiSelect: false }
}

function multi(name: string, options: string[], weight = 1): ChecklistParameter {
  return { kind: 'checklist', name, weight, options, multiSelect: true }
}

const AROMA_OPTIONS = [
  'פרחוני',
  'פרי ירוק',
  'פרי הדר',
  'פרי גלעין',
  'פרי טרופי',
  'פרי אדום',
  'פרי שחור',
  'עשבוני',
  'צמחי-מרפא',
  'תיבול',
  'פירות בשלים',
  'פירות לא בשלים',
  'פירות מיובשים',
  'פירות מבושלים',
  'שמרים/לחם',
  'חמאה/שמנת',
  'עץ אלון',
  'וניל',
  'תבלינים',
]

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: 'wine',
    label: 'יין חברתי',
    categories: [
      { name: 'נראות', weight: 1, parameters: [q('צבע'), q('צלילות')] },
      { name: 'באף', weight: 2, parameters: [q('פגם'), q('עוצמה'), q('מורכבות')] },
      {
        name: 'בפה',
        weight: 2,
        parameters: [q('חמיצות'), q('עפיצות'), q('איזון'), q('סיומת'), q('אורך')],
      },
      {
        name: 'כללי',
        weight: 3,
        parameters: [q('ייחודיות'), q('זניות'), q('אותנטיות'), q('ארצה שוב', 2)],
      },
    ],
  },
  {
    id: 'wine_pro',
    label: 'יין מקצועי - טעימה שיטתית',
    categories: [
      {
        name: 'אף',
        weight: 1,
        parameters: [
          single('עוצמה', ['קלה', 'בינונית', 'בולטת']),
          single('מצב', ['נקי', 'לא נקי']),
          multi('מאפייני ארומה', AROMA_OPTIONS),
        ],
      },
      {
        name: 'פה',
        weight: 1,
        parameters: [
          single('גוף', ['קליל', 'בינוני', 'מלא']),
          single('חומציות', ['נמוכה', 'בינונית', 'גבוהה']),
          single('טאנינים', ['נמוכים', 'בינוניים', 'גבוהים']),
          single('מתיקות', ['יבש', 'כמעט יבש', 'בינוני', 'מתוק']),
          single('אלכוהול', ['נמוך', 'בינוני', 'גבוה']),
          single('עוצמת טעם', ['קלה', 'בינונית', 'בולטת']),
          multi('מאפייני טעם', AROMA_OPTIONS),
          single('סיומת', ['קצרה', 'בינונית', 'ארוכה']),
        ],
      },
      {
        name: 'מראה',
        weight: 1,
        parameters: [
          single('צבע', [
            'ירוק-לימון',
            'לימון',
            'זהב',
            'ענבר',
            'חום',
            'ורוד',
            'ורוד-כתום',
            'כתום',
            'סגול',
            'אודם',
            'גרנדה',
            'חלודה',
          ]),
          single('בהירות', ['צלול', 'עכור']),
          single('עוצמת צבע', ['בהיר', 'בינוני', 'עמוק']),
        ],
      },
      {
        name: 'מסקנות',
        weight: 1,
        parameters: [
          single('ציון כללי', ['פגום', 'חלש', 'מקובל', 'טוב', 'טוב מאוד', 'יוצא מן הכלל']),
        ],
      },
    ],
  },
  {
    id: 'meat',
    label: 'בשר',
    categories: [
      {
        name: 'מראה חיצוני',
        weight: 1,
        parameters: [q('נראות הנתח'), q('אופן ההגשה'), q('יוצר גירוי')],
      },
      { name: 'ארומה וריח', weight: 1, parameters: [q('מעורר תיאבון'), q('ללא ריחות לוואי')] },
      {
        name: 'מרקם ועשייה',
        weight: 1,
        parameters: [q('נימוחות'), q('עסיסיות'), q('רמת עשייה נכונה')],
      },
      {
        name: 'טעם כללי',
        weight: 2,
        parameters: [q('טעם הנתח'), q('רצון לחזור על החוויה'), q('תמורה למחיר לק"ג')],
      },
    ],
  },
  {
    id: 'beer',
    label: 'בירה',
    categories: [
      {
        name: 'מראה וצלילות',
        weight: 1,
        parameters: [q('צבע וצלילות'), q('ראש הקצף'), q('אופן ההגשה וגירוי')],
      },
      { name: 'ארומה וריח', weight: 1, parameters: [q('עושר הניחוח'), q('ללא ריחות לוואי')] },
      {
        name: 'תחושת פה וגוף',
        weight: 1,
        parameters: [q('גוף וסמיכות'), q('גיזוז/קרבונציה'), q('טמפרטורת הגשה')],
      },
      {
        name: 'טעם וחוויה כללית',
        weight: 2,
        parameters: [q('איזון הטעמים'), q('רצון לחזור על החוויה'), q('תמורה למחיר')],
      },
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
  {
    id: 'whiskey',
    label: 'ויסקי',
    categories: [
      { name: 'מראה', weight: 1, parameters: [q('צבע'), q('צלילות')] },
      {
        name: 'אף',
        weight: 1,
        parameters: [q('עוצמה'), q('מורכבות'), q('ניחוחות (עץ/וניל/עשן/פרי)')],
      },
      {
        name: 'פה',
        weight: 2,
        parameters: [q('עוצמת טעם'), q('מורכבות'), q('איזון'), q('תחושת חום/גוף')],
      },
      { name: 'כללי', weight: 1, parameters: [q('אורך סיומת'), q('רצון לשוב אליו')] },
    ],
  },
  {
    id: 'cheese',
    label: 'גבינות',
    categories: [
      { name: 'מראה חיצוני', weight: 1, parameters: [q('צבע'), q('מרקם/קרום')] },
      { name: 'ריח', weight: 1, parameters: [q('עוצמה'), q('ניחוחות')] },
      { name: 'מרקם', weight: 1, parameters: [q('קשיחות/רכות'), q('קרמיות')] },
      {
        name: 'טעם כללי',
        weight: 2,
        parameters: [
          q('עוצמת טעם'),
          q('מליחות/חמיצות'),
          q('איזון'),
          q('רצון לחזור'),
          q('תמורה למחיר לק"ג'),
        ],
      },
    ],
  },
  {
    id: 'sausage',
    label: 'נקניקיות ונקניקים',
    categories: [
      { name: 'מראה', weight: 1, parameters: [q('צבע'), q('מרקם חיצוני')] },
      { name: 'ריח', weight: 1, parameters: [q('עוצמה'), q('תיבול מורגש')] },
      { name: 'מרקם', weight: 1, parameters: [q('נימוחות/קשיחות'), q('עסיסיות')] },
      {
        name: 'טעם כללי',
        weight: 2,
        parameters: [
          q('עוצמת טעם'),
          q('איזון תבלינים'),
          q('מליחות'),
          q('איכות הלחם/לחמנייה (אם מוגש עם)'),
          q('רצון לחזור'),
          q('תמורה למחיר לק"ג'),
        ],
      },
    ],
  },
  {
    id: 'burger',
    label: 'המבורגרים',
    categories: [
      { name: 'מראה', weight: 1, parameters: [q('נראות ההגשה'), q('צריבה')] },
      { name: 'ריח', weight: 1, parameters: [q('ניחוח בשרי'), q('עשן/גריל')] },
      {
        name: 'מרקם ועסיסיות',
        weight: 1,
        parameters: [q('נימוחות'), q('עסיסיות'), q('מידת עשייה')],
      },
      {
        name: 'טעם כללי',
        weight: 2,
        parameters: [
          q('טעם הבשר'),
          q('איכות הלחמנייה'),
          q('שילוב עם הרוטב/תוספות'),
          q('רצון לחזור'),
          q('תמורה למחיר'),
        ],
      },
    ],
  },
  {
    id: 'pizza',
    label: 'פיצה',
    categories: [
      { name: 'מראה', weight: 1, parameters: [q('צבע קרום'), q('פיזור תוספות')] },
      { name: 'ריח', weight: 1, parameters: [q('ניחוח בצק'), q('גבינה'), q('תבלינים')] },
      {
        name: 'בצק ומרקם',
        weight: 1,
        parameters: [q('פריכות/רכות'), q('עובי'), q('אחידות אפייה')],
      },
      {
        name: 'טעם כללי',
        weight: 2,
        parameters: [q('איזון תוספות ורוטב'), q('עוצמת טעם'), q('רצון לחזור'), q('תמורה למחיר')],
      },
    ],
  },
]
