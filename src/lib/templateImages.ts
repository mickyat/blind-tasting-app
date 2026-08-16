import type { StaticImageData } from 'next/image'
import wine from '../../public/images/templates/wine.jpg'
import meat from '../../public/images/templates/meat.jpg'
import beer from '../../public/images/templates/beer.jpg'
import coffee from '../../public/images/templates/coffee.jpg'
import whiskey from '../../public/images/templates/whiskey.jpg'
import cheese from '../../public/images/templates/cheese.jpg'
import sausage from '../../public/images/templates/sausage.jpg'
import burger from '../../public/images/templates/burger.jpg'
import pizza from '../../public/images/templates/pizza.jpg'
import winePro from '../../public/images/templates/wine-pro.jpg'

// Real photos for the template picker tiles (replaced the earlier hand-drawn
// SVG illustrations). All local files under public/images/templates/,
// downloaded from Unsplash (Unsplash License - free for commercial use, no
// attribution required, credited below anyway). Keyed by template id (not
// theme id) so wine_pro can use its own photo instead of collapsing into
// the wine theme.
//
// Imported statically (not referenced by string path) so Next.js can emit
// a content-hashed, long-cache /_next/image URL and auto-generate a blur
// placeholder - a string `src` gets neither: Next can't tell the file is
// immutable, so the optimizer serves it with `max-age=0` and re-fetches on
// every visit, which is what caused the color-flash-before-photo bug even
// after `priority` was added (that fixed lazy-loading, not caching).
//
// Credits (Unsplash photographers):
//   wine      - Noelia Vega (@noeliavega)
//   meat      - Samuel Regan-Asante (@reganography)
//   beer      - Shawn Xu (@shawnxxf)
//   coffee    - John (@johnishappysometimes)
//   whiskey   - Brett Jordan (@brett_jordan)
//   cheese    - Big Dodzy (@bigdodzy)
//   sausage   - Rich Smith (@richwilliamsmith)
//   burger    - Erik Odiin (@odiin)
//   pizza     - Nahima Aparicio (@nahimaaparicio)
//   wine_pro  - Madeline Liu (@madeline_sd)
export const TEMPLATE_IMAGES: Record<string, StaticImageData> = {
  wine,
  meat,
  beer,
  coffee,
  whiskey,
  cheese,
  sausage,
  burger,
  pizza,
  wine_pro: winePro,
}
