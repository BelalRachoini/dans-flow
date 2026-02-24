

# Prevent Duplicate Event Checkout Sessions

## Problem
Users can trigger multiple Stripe Checkout sessions for the same event by clicking the purchase button rapidly or navigating back and clicking again. This led to a real double-charge incident.

## Solution
Add a duplicate-session check in the `create-event-payment` edge function using the Stripe API to look for recent open/unpaid checkout sessions for the same user+event combination before creating a new one.

## Technical Approach

### 1. Edge Function: `create-event-payment/index.ts`

After authenticating the user and validating the event, **before** creating a new checkout session, query Stripe for recent checkout sessions matching this user+event:

- Use `stripe.checkout.sessions.list()` filtered by the customer ID (if one exists) to find sessions created in the last 30 minutes
- Check session metadata for matching `event_id` and `user_id`
- If an **open** (unpaid) session is found, return its existing URL instead of creating a new one
- If a **paid** session is found (meaning booking already completed or in progress), return an error to prevent double-purchase
- Only create a new session if no recent matching sessions exist

Key details:
- Time window: 30 minutes (Stripe sessions expire after 24h by default, but 30 min is a safe deduplication window)
- Filter by `status: 'open'` to only catch unpaid sessions
- Match on metadata fields (`event_id` + `user_id`) since multiple events could be in-flight
- If no customer ID exists yet (new customer), skip the Stripe check since there can't be a prior session
- This approach is resilient: if Stripe list fails for any reason, we fall through to creating a new session (no errors for edge cases)

### 2. Frontend: `EventTicketPurchaseDialog.tsx`

As a secondary safeguard, improve the UI:
- The `processing` state already disables the button, but ensure the dialog also closes or shows a "redirecting" state after getting the URL, preventing re-clicks during the redirect window

### Why this is safe and won't cause future errors

- **Graceful fallback**: If the Stripe sessions.list call fails, we catch the error, log it, and proceed to create a new session normally
- **No database dependency**: We check Stripe directly (source of truth for payment state), not a local table that could get out of sync
- **Expired sessions handled**: Stripe automatically expires old sessions; we only look at `open` status ones
- **Race condition safe**: Even if two requests slip through simultaneously, the existing `verify-event-payment` function already has a duplicate-booking guard that prevents double-booking in the database

