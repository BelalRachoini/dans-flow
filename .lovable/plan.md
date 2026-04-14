

# Deploy `verify-swish-payment` Edge Function

## Issue with Provided Code
The `payments` table has NO `order_id` column (only: `id`, `member_id`, `amount_cents`, `currency`, `status`, `description`, `created_at`). The idempotency check and insert referencing `order_id` will fail.

## Fix
- Use the `description` field for idempotency: store `"swish:WP_ORDER_ID"` in `description` and check against it
- Alternatively, skip the `payments` table insert entirely (the existing Stripe verify functions don't insert into `payments` either — they only create `event_bookings` / `tickets`)
- Best approach: match what Stripe verify functions do — no `payments` insert, use domain-specific idempotency (check `event_bookings` for events, `tickets.order_id` for standalone tickets)

## Plan

### 1. Create `supabase/functions/verify-swish-payment/index.ts`
Based on the provided code but with these fixes:
- **Remove** the `payments` table idempotency check and insert (no `order_id` column exists)
- **Event idempotency**: check `event_bookings` by `member_id` + `event_id` (same as `verify-event-payment`)
- **Course idempotency**: check `tickets` by `member_id` + `course_id` (same as `verify-course-payment`)
- **Standalone ticket idempotency**: check `tickets` by `order_id = swish:WP_ORDER_ID` (tickets table HAS `order_id`)
- Keep everything else from the provided code: CORS, service role client, event/course/ticket branching, email sending, no JWT auth

### 2. Add to `supabase/config.toml`
```
[functions."verify-swish-payment"]
verify_jwt = false
```

### 3. Deploy
Deploy the edge function using the deploy tool.

## No database changes needed
The existing tables (`event_bookings`, `tickets`, `courses`, `events`, `event_dates`) already have all required columns.

