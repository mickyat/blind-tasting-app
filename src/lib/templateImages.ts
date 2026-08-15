// Real photos for the template picker tiles (replaced the earlier hand-drawn
// SVG illustrations). All local files under public/images/templates/,
// downloaded from Unsplash (Unsplash License - free for commercial use, no
// attribution required, credited below anyway). Keyed by template id (not
// theme id) so wine_pro can use its own photo instead of collapsing into
// the wine theme.
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
export const TEMPLATE_IMAGES: Record<string, string> = {
  wine: '/images/templates/wine.jpg',
  meat: '/images/templates/meat.jpg',
  beer: '/images/templates/beer.jpg',
  coffee: '/images/templates/coffee.jpg',
  whiskey: '/images/templates/whiskey.jpg',
  cheese: '/images/templates/cheese.jpg',
  sausage: '/images/templates/sausage.jpg',
  burger: '/images/templates/burger.jpg',
  pizza: '/images/templates/pizza.jpg',
  wine_pro: '/images/templates/wine-pro.jpg',
}
