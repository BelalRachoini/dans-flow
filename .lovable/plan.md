## Goal

Make the member drawer's **Quick actions** panel more useful:

1. Remove the unused **Change Level** dropdown.
2. Replace it with a **Course picker** for the ticket-gift action (currently generic only).
3. Add a new **Event ticket** action: give a free event booking OR generate a comp/discount code for an event.

## Changes

### 1. `MemberDetailDrawer.tsx` — Quick actions redesign

Remove the Change Level block (lines 591-615). New grid layout (2 columns):

- **Give Tickets (class)**
  - Existing input + expiry date
  - **New**: optional `Select` "Tie to course (optional)" listing all courses (`title`, sorted by `starts_at desc`). Default "Generic – any class".
  - Selection sets `p_source_course_id` on the RPC.
- **Remove Tickets** — unchanged
- **Give Event Ticket** *(new)*
  - `Select` event (published events sorted by `start_at desc`, future first)
  - If event has multiple `event_dates`, second `Select` for date (or "All dates")
  - Number of attendees (default 1)
  - Two action buttons:
    - **Create free booking** → calls new edge function `admin-create-event-booking`
    - **Generate comp code** → calls new edge function `admin-create-event-comp-code`
- **Change Role** — unchanged
- **Manual Check-in** — unchanged

### 2. DB migration

a. Extend `admin_give_free_tickets` RPC with `p_source_course_id uuid default null` parameter, persisted to `tickets.source_course_id`.

b. New RPC `admin_create_free_event_booking(p_member_id uuid, p_event_id uuid, p_event_date_id uuid, p_ticket_count int, p_attendee_names jsonb)`:
- Admin-only check
- Inserts into `event_bookings` with `status='confirmed'`, `payment_status='comp'`, `payment_reference='admin_gift:<admin_uid>'`
- Returns booking id + qr_payload

c. New table `event_comp_codes` (admin-issued discount codes):
```
id uuid pk, code text unique, event_id uuid, percent_off int,
max_uses int default 1, uses int default 0,
created_by uuid, created_for uuid (member, optional),
expires_at timestamptz, created_at timestamptz
```
With RLS: admin manage all; anyone can SELECT a row by code (used at checkout validation).

d. Update `create-event-checkout` edge function (separate scope — note only) to accept `comp_code` query param. *Out of scope for this plan if user wants comp-code redemption later; we'll just generate codes now and surface them as copyable text.*

### 3. Translations (`sv/en/es.ts`)

Add under `crm.actions`:
- `giveEventTicket`, `selectEvent`, `selectEventDate`, `allDates`, `tieToCourse`, `genericCourse`
- `createFreeBooking`, `generateCompCode`
- `compCodeCreated` (toast: "Code {code} created – copy and share")

### 4. Edge function: `admin-create-event-booking`

Validates admin via JWT + `is_admin()`, calls new RPC. Triggers confirmation email reusing existing `send-email` pattern.

### 5. Wire-up

- `MemberDetailDrawer` fetches courses + events via `useQuery` (cached, only when drawer open).
- New mutations: `giveEventTicketMutation`, `generateCompCodeMutation`.
- Toasts in user's language; refetch `tickets`/`event_bookings` after success.

## Out of scope

- Comp-code redemption at Stripe checkout (separate follow-up).
- Editing existing event bookings.
- Email customization for admin-gifted bookings (uses existing template).

## Files touched

- `src/components/MemberDetailDrawer.tsx`
- `src/locales/{sv,en,es}.ts`
- `supabase/functions/admin-create-event-booking/index.ts` (new)
- Migration: alter `admin_give_free_tickets`, add `admin_create_free_event_booking`, add `event_comp_codes` table + RLS
