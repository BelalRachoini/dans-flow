

# Automated Confirmation Emails with PDF Receipts for All Purchases

## Overview
Add PDF receipt generation and attach it to every purchase confirmation email. Also add a confirmation email to the lesson drop-in payment flow (currently the only payment type missing one).

## Current State
- **Event purchases** -- confirmation email sent (no PDF receipt)
- **Course purchases** -- confirmation email sent (no PDF receipt)
- **Standalone ticket purchases** -- confirmation email sent (no PDF receipt)
- **Lesson drop-in purchases** -- NO confirmation email at all

## What Changes

### 1. Enhance `send-email` edge function
Add support for an optional `receipt` parameter. When provided, the function will:
- Generate a PDF receipt (built from scratch, no heavy library needed -- raw PDF format)
- Attach it to the email via Resend's `attachments` API
- The receipt includes: company info (DanceVida), customer name, purchase date, line items with amounts, total, order reference, and a "Thank you" note

Receipt data structure:
```text
{
  receipt: {
    customerName: "John Doe",
    customerEmail: "john@example.com",
    date: "2026-02-24",
    items: [{ description: "Salsa Beginners Course", quantity: 1, unitPrice: 1500, currency: "SEK" }],
    totalAmount: 1500,
    currency: "SEK",
    orderId: "cs_xxx...",
    companyInfo: { name: "DanceVida", address: "Gamlestadsv. 14, 415 02 Goteborg", phone: "073-702 11 34" }
  }
}
```

### 2. Update `verify-event-payment`
After creating bookings and before sending the email, gather receipt data from the Stripe session (amount, currency) and pass it to `send-email` along with the existing HTML.

### 3. Update `verify-course-payment`
Same pattern -- extract amount from the Stripe session and include receipt data in the email call.

### 4. Update `verify-standalone-ticket-payment`
Same pattern -- include receipt data with amount from `session.amount_total`.

### 5. Update `verify-lesson-payment`
- Fetch lesson and course details for the email
- Build a confirmation email (bilingual Swedish/English, same style as the other purchase emails)
- Send it via `send-email` with receipt data attached

## Technical Details

### PDF Generation (in `send-email`)
The PDF will be generated using raw PDF format strings -- no external library needed. This produces a clean, lightweight receipt PDF containing:
- DanceVida header with company details
- "KVITTO / RECEIPT" title
- Customer name and email
- Date of purchase
- Itemized table (description, qty, unit price, line total)
- Total amount with currency
- Order reference number
- Footer with company address and contact

The PDF is encoded as base64 and passed to Resend via the `attachments` field:
```typescript
await resend.emails.send({
  from: "Dance Vida Tickets <tickets@dancevida.se>",
  to: [to],
  subject,
  html,
  attachments: [{
    filename: "kvitto-dancevida.pdf",
    content: base64PdfString, // base64 encoded
  }]
});
```

### Files Modified
1. `supabase/functions/send-email/index.ts` -- add PDF generation + attachment support
2. `supabase/functions/verify-event-payment/index.ts` -- pass receipt data to send-email
3. `supabase/functions/verify-course-payment/index.ts` -- pass receipt data to send-email
4. `supabase/functions/verify-standalone-ticket-payment/index.ts` -- pass receipt data to send-email
5. `supabase/functions/verify-lesson-payment/index.ts` -- add full confirmation email with receipt

### No database changes needed
### No frontend changes needed

All emails will continue to be sent via the existing `send-email` function, and all existing HTML templates remain unchanged -- the PDF receipt is simply attached alongside.

