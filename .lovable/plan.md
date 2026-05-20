## Goal

On the Biljetter page, show the purchase date on every ticket card (event bookings, lesson bookings, standalone ticket packages) in both the active and history sections, for members and admins.

## Format

- Label: `Köpt:` (sv) / `Purchased:` (en) / `Comprado:` (es)
- Value: ISO short date `YYYY-MM-DD` (e.g. `2026-05-20`)
- Placement: small muted line in the card metadata area (below title / alongside existing meta)

## Source of date per ticket type

- Event bookings → `event_bookings.booked_at` (fallback `created_at`)
- Lesson bookings → `lesson_bookings.purchased_at` (fallback `created_at`)
- Standalone ticket packages → `tickets.purchased_at`

All fields already exist — no schema changes.

## Changes

1. `src/locales/sv.ts`, `src/locales/en.ts`, `src/locales/es.ts` — add a `tickets.purchasedOn` translation key.
2. `src/pages/Biljetter.tsx` — render the purchase date line on each ticket card variant (active event, history event, active lesson, history lesson, standalone package). Use a single small helper to format `YYYY-MM-DD`.

No backend, edge function, RLS, or query changes — the timestamps are already returned by current selects (verified during exploration; if any select omits the column I'll add it).

## Verification

- Visit `/biljetter` as a member: each ticket card (event, lesson, standalone) shows `Köpt: 2026-05-20`.
- Switch language to EN/ES: label translates, date stays `YYYY-MM-DD`.
- History section: same line visible on past tickets.
- Admin viewing the same page: same line visible (admins use the same component).
