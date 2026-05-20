## Goal
Customers can view all their payments (Stripe + Swish) on **Mina betalningar** and download a clean, professional-looking PDF receipt/kvitto.

## Current state
- `/mina-betalningar` page already exists (`src/pages/MyPayments.tsx`) and is linked in the sidebar for the MEDLEM role.
- It currently only reads from `payments` (Stripe) — **Swish payments are missing**.
- The `generate-receipt` edge function supports both `stripe` and `swish`, but produces a very plain ASCII-only PDF (Swedish characters like å/ä/ö stripped, no styling, no logo, no table layout) — does not look good.
- `supabase.functions.invoke` returns the binary as `Blob`/`ArrayBuffer`; the current `new Blob([data])` works inconsistently for PDFs.

## Changes

### 1. `src/pages/MyPayments.tsx` — show all payments
- Query both `payments` (Stripe) and `swish_payments` for the logged-in member.
- Normalize into a unified list with `source: 'stripe' | 'swish'`, description (use `metadata.description` / `payment_type` / event/course title fallback for Swish), amount, date, status.
- Sort combined list by `created_at` desc.
- Show a small badge per row indicating the payment method (Kort / Swish) instead of the hardcoded "· Kort".
- Pass the correct `payment_source` when calling `generate-receipt`.
- Fix the download: request the PDF via `fetch` against the function URL (with the user's access token) so we get a real binary `Blob`. Trigger download via object URL. Keep loading spinner.

### 2. `supabase/functions/generate-receipt/index.ts` — make the PDF look good
Rewrite the PDF generator using a small in-edge library that supports proper Unicode + layout. Use **pdf-lib** (`npm:pdf-lib`) with the bundled **StandardFonts.Helvetica** plus an embedded TTF for Swedish characters (e.g. Inter or Noto Sans via a fetched font file cached per cold start). This removes the ascii() transliteration.

Layout (A4 portrait, 595×842):
- Header band in brand gold (`#c59333`) with company name "Tropical Studios" left-aligned and the word **KVITTO / RECEIPT** right-aligned, both in white.
- Below header, two columns:
  - Left: **Från** — company name, address, org.nr, VAT, e-mail, phone.
  - Right: **Kvitto till** — customer full name, e-mail.
- Metadata row: Kvittonummer (short id), Datum, Betalningsmetod (Kort/Swish), Status.
- Items table with header row (light gold tint background, gray border):
  - Columns: Beskrivning · Antal · À-pris · Summa.
  - Right-aligned numeric columns, padding and zebra-striping.
- Totals block right-aligned: Subtotal, (no VAT line — no VAT registration assumed; show "Moms ingår: 0%" only if a flag is set), **Totalt** in bold gold.
- Footer: thank-you line in Swedish + small print "Detta kvitto är genererat automatiskt av Tropical Studios."
- Page margins 50px, consistent line-height, generous whitespace.

Other function changes:
- Resolve a richer description for Swish receipts using related `event_bookings` / `tickets` (heuristic match by member + ±30 min window) so the line item reads e.g. *"Eventbiljett: Golden Knight Party — 2 biljetter"* instead of generic "Betalning".
- Keep CORS, auth and ownership checks unchanged.

### 3. Translations
Add the new strings (method labels, "Kort", "Swish", empty-state copy, etc.) to `src/locales/sv.ts`, `en.ts`, `es.ts` under the existing `myPayments` key.

## Out of scope
- No DB migrations.
- No changes to the admin Betalningar page.
- No changes to checkout / payment creation flows.

## Verification
1. Log in as a member who has both a Stripe payment and a Swish payment → both appear on `/mina-betalningar`, correctly labelled.
2. Click **Ladda ner kvitto** on a Stripe row → A4 PDF opens with the new branded layout, Swedish characters intact.
3. Same for a Swish row → line item shows the resolved event/ticket description.
4. Empty-state still renders when no payments exist.
5. Non-owner cannot download (403 still enforced by edge function).