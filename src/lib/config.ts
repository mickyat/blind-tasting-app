// Central switch for plan-limit banners shown to end users (event-count on
// the home page, participant-count on the host dashboard). The underlying
// tracking (visitor_event_count, plan.max_* lookups) always keeps running
// regardless of this flag - only the user-facing banner is gated - so the
// counts stay accurate for whenever this flips back to true.
export const SHOW_PLAN_LIMIT_BANNERS = false
