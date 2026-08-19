// Anonymous per-browser identifier, set once (in createEvent) via a
// long-lived cookie - not a login, just enough to durably count "how many
// events has this browser ever created" across the app's no-login
// architecture. Read from both the event-creation server action and the
// homepage (to show the lifetime-limit banner). httpOnly since nothing
// client-side ever needs to read or write it directly.
export const VISITOR_ID_COOKIE = 'bt_visitor_id'
export const VISITOR_ID_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2 // 2 years
