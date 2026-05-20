## What actually happened with Sofia's 350 kr

I traced her payment in the database. There is nothing wrong:

- **Payment**: `swish:4257`, 350 kr, status `succeeded`, type `tickets`, description `Klippkort: 3 st`, paid 18 May 14:12.
- **What she got**: 1 row in `tickets` — a **standalone flexible klippkort** with `total_tickets=3`, `tickets_used=0`, `source_course_id = NULL`, `course_id = NULL`, expires 18 Aug 2026.
- **Event bookings**: none. Lesson bookings: none. Check-ins: none.

So she did **not** buy a class, a workshop, or a party. She bought a **3-use flexible klippkort package** that she can spend on any drop-in class within 3 months. That's why you can't find her name in any event or class — she hasn't used the tickets yet.

The data is correct. The problem is the admin UX: the Payments page just says "Klippkort: 3 st" with no way to drill in, and there is no obvious place to answer "what did this person actually get for their money, and have they used it?".

## Fix — make payments self-explanatory and drillable

All changes are in `src/pages/Betalningar.tsx` (plus one small helper). No DB changes, no edge functions, no schema.

### 1. Enrich the row description automatically

When loading payments, also fetch (in parallel, per visible page):
- For `payment_type = 'tickets'` → look up `tickets` row by `order_id`. Show:
  - **Standalone klippkort** (no `source_course_id`) → label `Klippkort 3 st — flexibel (ej kopplad till kurs)`, plus `Använt 0/3 · Utgår 2026-08-18`.
  - **Course-derived klippkort** → label `Klippkort 3 st — {course.title}`, plus usage + expiry.
- For `payment_type = 'event'` → look up `event_bookings` by `payment_reference` matching `order_id`. Show `{event.title} — {ticket_count} biljett(er) · {start_at}` + check-in count.
- For `payment_type = 'lesson'` → look up `lesson_bookings` similarly, show `{lesson.title} · {starts_at}`.
- Fallbacks: if nothing found, keep the raw `description` but add a small `Inte kopplad` muted tag so the admin knows it's an orphan and can investigate.

This means the table immediately answers "what did they buy?" without clicking — Sofia's row would read:
> **Klippkort 3 st — flexibel (ej kopplad till kurs)** · Använt 0/3 · Utgår 18 aug 2026

### 2. Make every row clickable → "Betalningsdetaljer" dialog

Clicking a row opens a side dialog showing:
- Payment metadata (id, order_id, method, amount, status, created_at).
- **Vad köptes** (resolved entity name + link to the course/event/lesson page where applicable).
- **Status nu**: for tickets — remaining/used/expiry; for events — checked-in count + which date; for lessons — check-in status.
- **Köparen**: name, email, phone, link to the member CRM row.
- A "Gå till medlem" button → `/admin/members/{id}` (or whatever the existing member detail route is) so you can see all their tickets and history.

### 3. New filter: "Visa endast okopplade betalningar"

A toggle that filters to payments where no matching `tickets` / `event_bookings` / `lesson_bookings` record exists. This is the "is something broken?" view. For Sofia today this filter would be empty — confirming her purchase is fine.

### 4. Tooltip on the "Klippkort" type badge

Hover the `Klippkort` badge → explains: "Flexibelt klippkort som kan användas på valfri drop-in-klass inom giltighetstiden." This removes the conceptual confusion that made you go looking in Events.

### Technical notes

- Resolution queries run once per page render (one query per type, batched by collecting all `order_id`s and using `.in('order_id', [...])`). Cached in component state.
- All new strings go through `useLanguageStore()` for sv/en/es.
- `Payment` type extends with optional `resolved: { kind: 'standalone_klippkort' | 'course_klippkort' | 'event' | 'lesson' | 'orphan', label: string, secondary?: string, link?: { to: string; label: string } }`.

## Verification

1. Open `/betalningar`. Sofia's row reads `Klippkort 3 st — flexibel (ej kopplad till kurs) · Använt 0/3 · Utgår 18 aug 2026`. ✓
2. Click the row → dialog shows full details + "Gå till medlem" button. ✓
3. Toggle "Visa endast okopplade" → Sofia is gone (she has a ticket row). ✓
4. Click `/admin/members/{Sofia}` from the dialog → her 3 unused tickets visible. ✓
5. Hover the `Klippkort` badge → tooltip explains what it means. ✓

## Question

Should I **also surface this enrichment on the member detail page** (showing "Bought 3 tickets via Swish on 18 May, 0/3 used, expires 18 Aug" right under her name), or is fixing the Payments page enough for now?
