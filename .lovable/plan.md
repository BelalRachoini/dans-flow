## Problem

The three Swish confirmation emails (event, course, standalone tickets) currently send a plain HTML body with only a "Visa mina biljetter" button. They contain:
- No QR code(s) for the ticket
- No PDF invoice/receipt attachment

Stripe flows already attach a PDF receipt via `send-email` (which supports a `receipt` payload) and customers can view QRs in the portal — but Swish skipped both.

## Fix

Update `supabase/functions/verify-swish-payment/index.ts` so that **every** branch (event / course / ticket) sends an email that includes:

1. **Embedded QR code image(s)** in the HTML body, rendered via a public QR image service (`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=<qr_payload>`) — same approach used elsewhere for inline emails. This works in all major email clients without needing CID attachments.
2. **PDF receipt attachment** by passing a `receipt` object to `send-email` (it already generates and attaches `kvitto-dancevida.pdf` when this field is present).

### Per branch

**Event**
- After creating bookings, loop over `createdBookings` and render one QR block per booking (one per person per date), labeled with the attendee name and the date. For multi-day events this matches the existing "separate QR per person per date" memory.
- Receipt line item: `Event: <title> – <ticketCount> person(er) × <dates> dag(ar)`, `unitPrice = amount_cents / (ticketCount * dates)`.

**Course**
- One QR block for the single created `ticket.qr_payload` with label "Klippkort för <course title>".
- Receipt line item: `Kurs: <title>`, qty 1.

**Standalone ticket**
- One QR block for the created `ticket.qr_payload`, label "Klippkort (<n> klipp)".
- Receipt line item: `Klippkort: <ticketCount> st`, qty 1.

### Receipt payload shape (already supported by `send-email`)

```ts
receipt: {
  customerName, customerEmail,
  date: new Date().toLocaleDateString('sv-SE'),
  items: [{ description, quantity, unitPrice: amount_cents / qty, currency: 'SEK' }],
  totalAmount: amount_cents,
  currency: 'SEK',
  orderId: wp_order_id ? `swish:${wp_order_id}` : `swish:${createdBookings[0].id}`,
  companyInfo: { name: 'DanceVida', address: '...', phone: '...' },
}
```

Use the same `companyInfo` constants the Stripe verify functions already use (will copy them verbatim from `verify-event-payment`).

### Shared HTML helper

Add a small inline helper inside the function file:

```ts
function qrBlock(payload: string, label: string) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(payload)}`;
  return `<div style="text-align:center;margin:14px 0;padding:14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;">
    <div style="font-size:13px;color:#374151;margin-bottom:8px;font-weight:600;">${label}</div>
    <img src="${url}" alt="QR" width="240" height="240" style="display:inline-block;border-radius:8px;background:#fff;padding:8px;" />
  </div>`;
}
```

Insert the joined QR blocks into the email HTML right above the "Visa mina biljetter" button in all three branches.

### No changes needed to

- `send-email` (already supports `receipt` + PDF attachment).
- WordPress / Swish payment flow.
- DB schema, Stripe flows, admin views.

## Deploy

Redeploy `verify-swish-payment` after the change.

## Verification

After deploy, trigger a small Swish test for each of the three item types and confirm the email contains:
- QR code image(s) rendered inline.
- A `kvitto-dancevida.pdf` attachment with the correct amount.
