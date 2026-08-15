// One consistent "this is the main action" button style for the whole app,
// deliberately NOT theme-dependent (unlike THEME_STYLES) so it stays legible
// no matter how dark/deep an event's theme background is. Colors verified
// with the WCAG contrast formula: button text vs button bg ~11.6:1, button
// bg vs every theme's page background 8-11:1, white border vs every theme
// background 12-16.6:1 - all comfortably clear of the thresholds that
// matter (4.5:1 text, ~3:1 UI component boundary).
export const PRIMARY_BUTTON_CLASS =
  'rounded-xl border-2 border-white bg-[#a3e635] px-4 py-4 text-base font-bold text-[#1c1917] shadow-sm disabled:opacity-40'
