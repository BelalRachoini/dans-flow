## Goal

Give admins one-click CSV exports of attendee lists (for printing at the door) and accountant-ready financial breakdowns, for both **courses** (incl. package classes) and **events**.

## What exists today

- `EventAttendeesDialog` already has an "Exportera CSV" button — but it's missing **phone** and doesn't include the event date.
- `Betalningar` and `MedlemmarCRM` already export their own CSVs.
- `Biljetter` (admin "View Attendance") has **no export** for courses or package classes — only on-screen lists.

## What to add

### 1. Course attendees export (Biljetter → Courses tab)

Add an **Export CSV** button next to the stats row whenever a course is selected.

- **Regular courses:** one row per attendee (unique member) with: Name, Email, Phone, Dance role, Tickets remaining, Total check-ins, First purchase date, Amount paid (SEK), Payment method.
- **Package courses:** the same row format, plus a **Class** column listing which package class(es) the member is enrolled in (e.g. "Salsa, Bachata"). Also add a per-class export button on each class card so an instructor can print just one class's roster.

Source data: `tickets` (with profiles) joined to `payments` (via `member_id` + `source_course_id` reference in `description`/`order_id`) — we'll match the most recent successful payment for the course. For package classes we use the same union we just fixed in `loadPackageClassesAttendance` (course_class_selections ∪ lesson_bookings).

### 2. Event attendees export (extend existing)

In `EventAttendeesDialog.exportCsv` add columns:
- **Telefon** (from `profiles.phone`)
- **Event datum** (from the selected `event_date` or event start)

Keep the existing columns. Filename stays the same.

### 3. Accountant export (new section in Betalningar)

A second button next to the existing "Exportera CSV" called **"Export för bokföring"** that produces a finance-friendly CSV with:
- Date (paid_at)
- Order ID
- Payment method (stripe / swish / comp / manual)
- Type (course / event / drop-in / package / standalone)
- Item title (course or event name)
- Buyer name + email
- Gross amount (SEK), Currency
- Status

This pulls straight from `payments` (already admin-readable), enriched with course/event titles via two cheap lookups. Sorted by date desc; honours the existing date-range filter on the page.

## Out of scope

- No PDF generation — CSV opens cleanly in Excel/Numbers, prints from there.
- No new tables or migrations.
- No changes to the attendance-counting logic.
- No bulk email/SMS to the exported list.

## Technical notes

- All exports use the same UTF-8 BOM + quoted-CSV pattern already in `MedlemmarCRM.exportToCSV` (Excel-friendly).
- Filenames: `course-<slug>-attendees-YYYYMMDD.csv`, `package-<slug>-<class>-YYYYMMDD.csv`, `event-<slug>-attendees-YYYYMMDD.csv`, `bokforing-YYYYMMDD.csv`.
- Phone is read from `profiles.phone` (already joined in the attendee queries; just need to add to the select in the event dialog).
- Amount-paid lookup for courses: `payments` rows where `member_id = attendee` and `description ILIKE '%<course title>%'` OR `order_id` matches the ticket's `order_id` — prefer the latter when present, fall back to title match, leave blank if no payment row (e.g. admin-gifted tickets).

## Files touched

- `src/pages/Biljetter.tsx` — add export buttons + helpers for course / package / per-class CSV
- `src/components/EventAttendeesDialog.tsx` — add phone + event date columns
- `src/pages/Betalningar.tsx` — add second "Export för bokföring" button + helper
- `src/locales/sv.ts`, `en.ts`, `es.ts` — new button/toast labels
