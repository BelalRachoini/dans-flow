
# Migrate All Emails from SMTP to Resend

## Overview
Replace the current SMTP-based email sending (via `denomailer` + one.com) with Resend across all edge functions. The sender address stays `tickets@dancevida.se`.

## What Changes

### 1. Add `RESEND_API_KEY` secret
- Store your Resend API key as a secret so all edge functions can use it.

### 2. Rewrite `send-email` edge function
- Remove `denomailer` SMTP client
- Replace with `Resend` from `npm:resend@4.0.0`
- Same interface (`to`, `subject`, `html`) -- all callers remain unchanged
- Send from `Dance Vida Tickets <tickets@dancevida.se>`

### 3. Rewrite `auth-send-email` edge function
- Remove `denomailer` SMTP client
- Replace with `Resend` for sending
- Keep all existing HTML templates (signup, recovery, magic link) exactly as-is
- Same payload parsing and routing logic

### 4. No changes needed to callers
Since `send-email` keeps the same request/response contract, these files need zero changes:
- `verify-course-payment/index.ts` (calls `send-email`)
- `verify-event-payment/index.ts` (calls `send-email`)
- `verify-standalone-ticket-payment/index.ts` (calls `send-email`)
- `src/pages/Auth.tsx` (calls `send-email` for welcome email)

### 5. SMTP secrets
The old SMTP secrets (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`) will no longer be used. They can be removed later if desired.

## Technical Details

**`send-email/index.ts`** -- new implementation:
```
import { Resend } from "npm:resend@4.0.0"
const resend = new Resend(Deno.env.get("RESEND_API_KEY"))

// Same { to, subject, html } interface
// Send via: resend.emails.send({ from, to, subject, html })
```

**`auth-send-email/index.ts`** -- same change pattern:
- Replace SMTP client with Resend
- All HTML template builder functions stay identical
- Same auth payload parsing logic

Both functions deploy automatically after code changes.
