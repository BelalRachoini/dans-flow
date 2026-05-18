## Update company info on Swish receipts & emails

### 1. `supabase/functions/verify-swish-payment/index.ts`

Replace `COMPANY_INFO` constant with the full legal info:
```ts
const COMPANY_INFO = {
  name: 'DANCE VIDA - Fabian Vallejos',
  company: 'Tropical Studios AB',
  orgNumber: '559326-1778',
  vatNumber: 'SE559326177801',
  address: 'Gamlestadsvägen 14, 415 02 Göteborg',
  phone: '073-702 11 34',
  email: 'info@tropicalstudios.se',
};
```

Update all 3 email header blocks (event, course, ticket) — change the `<div style="font-size:18px;font-weight:700;">DanceVida</div>` to render two lines:
```
DANCE VIDA
Tropical Studios AB
```

The 3 `companyInfo: COMPANY_INFO` payloads passed to `sendEmailWithReceipt` already forward the whole object — no further change needed there.

### 2. `supabase/functions/generate-receipt/index.ts`

- Extend `ReceiptData.companyInfo` type to include optional `company`, `orgNumber`, `vatNumber`, `email`.
- Replace the local fallback `companyInfo` (line 159 — currently `{ name: 'DanceVida', address: 'Stockholm, Sweden', phone: '+46 70 123 4567' }`) with the same full legal info as above so direct downloads from the dashboard also show correct details.
- In `generateReceiptPdf`, after the address/phone lines, render the new fields when present:
  ```
  Org.nr: 559326-1778
  VAT: SE559326177801
  E-post: info@tropicalstudios.se
  ```
  Also render `company` (Tropical Studios AB) under the brand name in the header.
- PDF uses Helvetica (Type1) which doesn't render Swedish diacritics — keep an ASCII variant for the PDF address ("Gamlestadsvagen 14, 415 02 Goteborg") while keeping full UTF-8 in the HTML emails. Apply the same ASCII-safe fallback to the footer line.

### 3. Deploy

Deploy both functions: `verify-swish-payment` and `generate-receipt`.

### Out of scope
Other verify-*/email functions (Stripe course/event/lesson, standalone-ticket) also pass their own `COMPANY_INFO`. This task only touches the Swish path + shared receipt renderer. If you want all flows updated, say so and I'll extend the change.
