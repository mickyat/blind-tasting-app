// Template content (labels, category/parameter names, checklist option
// labels) is translated - this file only holds stable IDs and structure.
// Display text lives in src/messages/{he,en}.json under "templates" (+
// "aromaOptions" for the shared aroma-descriptor list), resolved via the
// templateLabel/categoryName/parameterName/optionLabel/aromaOptionLabel
// helpers below, which any caller with a next-intl `t` can use.

interface ScaleParameter {
  kind: 'scale'
  id: string
  weight: number
  scaleMin: number
  scaleMax: number
}

export interface ChecklistParameter {
  kind: 'checklist'
  id: string
  weight: number
  optionIds: string[]
  multiSelect: boolean
  // 'own': option labels live under this parameter's own translation node
  // (options differ in wording/grammar per parameter, e.g. Hebrew gendered
  // adjectives - "low" for acidity vs tannin vs alcohol are different
  // words). 'aroma': option labels come from the shared aromaOptions pool
  // instead (safe to share since those are plain nouns, no agreement issue).
  optionsSource: 'own' | 'aroma'
}

export type TemplateParameter = ScaleParameter | ChecklistParameter

interface TemplateCategory {
  id: string
  weight: number
  parameters: TemplateParameter[]
}

export interface EventTemplate {
  id: string
  categories: TemplateCategory[]
}

function q(id: string, weight = 1): ScaleParameter {
  return { kind: 'scale', id, weight, scaleMin: 1, scaleMax: 5 }
}

function single(id: string, optionIds: string[], weight = 1): ChecklistParameter {
  return { kind: 'checklist', id, weight, optionIds, multiSelect: false, optionsSource: 'own' }
}

function multi(id: string, optionIds: string[], weight = 1): ChecklistParameter {
  return { kind: 'checklist', id, weight, optionIds, multiSelect: true, optionsSource: 'aroma' }
}

// An independently-composed set of broad aroma families for the checklist -
// same general idea as any aroma wheel, but our own grouping/wording/count,
// not reproducing a specific published taxonomy.
const AROMA_OPTION_IDS = [
  'floral',
  'citrus',
  'orchardFruit',
  'stoneFruit',
  'tropicalFruit',
  'redBerry',
  'darkFruit',
  'driedFruit',
  'herbalGreen',
  'spicy',
  'earthy',
  'mineral',
  'nutty',
  'toastedOak',
  'vanillaSweet',
  'smoky',
]

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: 'wine',
    categories: [
      { id: 'appearance', weight: 1, parameters: [q('color'), q('clarity')] },
      { id: 'nose', weight: 2, parameters: [q('flaw'), q('intensity'), q('complexity')] },
      {
        id: 'palate',
        weight: 2,
        parameters: [q('acidity'), q('astringency'), q('balance'), q('finish'), q('length')],
      },
      {
        id: 'overall',
        weight: 3,
        parameters: [q('uniqueness'), q('typicity'), q('authenticity'), q('wantAgain', 2)],
      },
    ],
  },
  {
    id: 'wine_pro',
    categories: [
      {
        id: 'nose',
        weight: 1,
        parameters: [
          single('intensity', ['light', 'medium', 'pronounced']),
          single('condition', ['clean', 'unclean']),
          multi('aromaCharacteristics', AROMA_OPTION_IDS),
        ],
      },
      {
        id: 'palate',
        weight: 1,
        parameters: [
          single('body', ['light', 'medium', 'full']),
          single('acidity', ['low', 'medium', 'high']),
          single('tannin', ['low', 'medium', 'high']),
          single('sweetness', ['dry', 'offDry', 'medium', 'sweet']),
          single('alcohol', ['low', 'medium', 'high']),
          single('intensity', ['light', 'medium', 'pronounced']),
          multi('flavourCharacteristics', AROMA_OPTION_IDS),
          single('finish', ['short', 'medium', 'long']),
        ],
      },
      {
        id: 'appearance',
        weight: 1,
        parameters: [
          single('colour', [
            'greenLemon',
            'lemon',
            'gold',
            'amber',
            'brown',
            'pink',
            'pinkOrange',
            'orange',
            'purple',
            'ruby',
            'garnet',
            'tawny',
          ]),
          single('clarity', ['clear', 'hazy']),
          single('intensity', ['pale', 'medium', 'deep']),
        ],
      },
      {
        id: 'conclusions',
        weight: 1,
        parameters: [
          single('qualityLevel', ['faulty', 'poor', 'acceptable', 'good', 'veryGood', 'outstanding']),
        ],
      },
    ],
  },
  {
    id: 'meat',
    categories: [
      {
        id: 'appearance',
        weight: 1,
        parameters: [q('cutLook'), q('platingStyle'), q('appetiteAppeal')],
      },
      { id: 'aroma', weight: 1, parameters: [q('appetizing'), q('noOffOdors')] },
      {
        id: 'texture',
        weight: 1,
        parameters: [q('tenderness'), q('juiciness'), q('donenessAccuracy')],
      },
      {
        id: 'overallTaste',
        weight: 2,
        parameters: [q('cutFlavor'), q('wantAgain'), q('pricePerKg')],
      },
    ],
  },
  {
    id: 'beer',
    categories: [
      {
        id: 'appearanceClarity',
        weight: 1,
        parameters: [q('colorClarity'), q('foamHead'), q('pourAppeal')],
      },
      { id: 'aroma', weight: 1, parameters: [q('aromaRichness'), q('noOffOdors')] },
      {
        id: 'mouthfeelBody',
        weight: 1,
        parameters: [q('bodyThickness'), q('carbonation'), q('servingTemp')],
      },
      {
        id: 'tasteExperience',
        weight: 2,
        parameters: [q('flavorBalance'), q('wantAgain'), q('valueForMoney')],
      },
    ],
  },
  {
    id: 'coffee',
    categories: [
      { id: 'aroma', weight: 1, parameters: [q('intensity'), q('aromaNotes')] },
      { id: 'taste', weight: 1, parameters: [q('acidity'), q('bitterness'), q('body')] },
      { id: 'overall', weight: 1, parameters: [q('balance'), q('wantAgain')] },
    ],
  },
  {
    id: 'whiskey',
    categories: [
      { id: 'appearance', weight: 1, parameters: [q('color'), q('clarity')] },
      {
        id: 'nose',
        weight: 1,
        parameters: [q('intensity'), q('complexity'), q('aromaNotes')],
      },
      {
        id: 'palate',
        weight: 2,
        parameters: [q('flavorIntensity'), q('complexity'), q('balance'), q('warmthBody')],
      },
      { id: 'overall', weight: 1, parameters: [q('finishLength'), q('wantAgain')] },
    ],
  },
  {
    id: 'cheese',
    categories: [
      { id: 'appearance', weight: 1, parameters: [q('color'), q('textureRind')] },
      { id: 'aroma', weight: 1, parameters: [q('intensity'), q('aromaNotes')] },
      { id: 'texture', weight: 1, parameters: [q('firmnessSoftness'), q('creaminess')] },
      {
        id: 'overallTaste',
        weight: 2,
        parameters: [
          q('flavorIntensity'),
          q('saltinessAcidity'),
          q('balance'),
          q('wantAgain'),
          q('pricePerKg'),
        ],
      },
    ],
  },
  {
    id: 'sausage',
    categories: [
      { id: 'appearance', weight: 1, parameters: [q('color'), q('exteriorTexture')] },
      { id: 'aroma', weight: 1, parameters: [q('intensity'), q('noticeableSpice')] },
      { id: 'texture', weight: 1, parameters: [q('tendernessFirmness'), q('juiciness')] },
      {
        id: 'overallTaste',
        weight: 2,
        parameters: [
          q('flavorIntensity'),
          q('spiceBalance'),
          q('saltiness'),
          q('breadQuality'),
          q('wantAgain'),
          q('pricePerKg'),
        ],
      },
    ],
  },
  {
    id: 'burger',
    categories: [
      { id: 'appearance', weight: 1, parameters: [q('platingLook'), q('sear')] },
      { id: 'aroma', weight: 1, parameters: [q('meatyAroma'), q('smokeGrill')] },
      {
        id: 'textureJuiciness',
        weight: 1,
        parameters: [q('tenderness'), q('juiciness'), q('doneness')],
      },
      {
        id: 'overallTaste',
        weight: 2,
        parameters: [
          q('meatFlavor'),
          q('bunQuality'),
          q('sauceToppingsMatch'),
          q('wantAgain'),
          q('valueForMoney'),
        ],
      },
    ],
  },
  {
    id: 'pizza',
    categories: [
      { id: 'appearance', weight: 1, parameters: [q('crustColor'), q('toppingDistribution')] },
      { id: 'aroma', weight: 1, parameters: [q('doughAroma'), q('cheese'), q('herbs')] },
      {
        id: 'doughTexture',
        weight: 1,
        parameters: [q('crispinessSoftness'), q('thickness'), q('bakeUniformity')],
      },
      {
        id: 'overallTaste',
        weight: 2,
        parameters: [q('toppingsSauceBalance'), q('flavorIntensity'), q('wantAgain'), q('valueForMoney')],
      },
    ],
  },
]

type Translate = (key: string) => string

export function templateLabel(t: Translate, templateId: string): string {
  return t(`templates.${templateId}.label`)
}

export function categoryName(t: Translate, templateId: string, categoryId: string): string {
  return t(`templates.${templateId}.categories.${categoryId}.name`)
}

export function parameterName(
  t: Translate,
  templateId: string,
  categoryId: string,
  parameterId: string
): string {
  return t(`templates.${templateId}.categories.${categoryId}.parameters.${parameterId}.name`)
}

export function checklistOptionLabel(
  t: Translate,
  templateId: string,
  categoryId: string,
  parameterId: string,
  optionId: string
): string {
  return t(
    `templates.${templateId}.categories.${categoryId}.parameters.${parameterId}.options.${optionId}`
  )
}

export function aromaOptionLabel(t: Translate, optionId: string): string {
  return t(`aromaOptions.${optionId}`)
}

// Resolves every option label for a checklist parameter at once, picking
// the right source (the parameter's own translations, or the shared aroma
// pool) so callers don't need to know about optionsSource themselves.
export function checklistOptionLabels(
  t: Translate,
  templateId: string,
  categoryId: string,
  parameter: ChecklistParameter
): string[] {
  return parameter.optionIds.map((optionId) =>
    parameter.optionsSource === 'aroma'
      ? aromaOptionLabel(t, optionId)
      : checklistOptionLabel(t, templateId, categoryId, parameter.id, optionId)
  )
}
