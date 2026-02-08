

## Plan: Add Swish as Payment Option

### Overview
Add Swish as an alternative payment method alongside Stripe across all payment flows (events, courses, standalone tickets, drop-in lessons). When a member checks out, they choose between Stripe (card) and Swish. Swish payments are recorded in the database and appear in the admin Payments (Betalningar) page.

### How Swish Works (Technical Background)

Swish uses mutual TLS (mTLS) with client certificates for API authentication. The flow is:
1. Your server creates a payment request via Swish API
2. On mobile: the user is redirected to the Swish app via a deep link
3. On desktop: the user enters their phone number and confirms in the Swish app
4. Swish sends a callback (POST) to your server confirming payment
5. Your server fulfills the order (creates tickets/bookings)

### Architecture

```text
Member clicks "Pay with Swish"
        |
        v
Frontend --> create-swish-payment (Edge Function)
                |
                v
        Swish API (mTLS with certificates)
                |
                v
        Returns payment token
                |
        +-------+-------+
        |               |
    [Mobile]        [Desktop]
  Open Swish app   Enter phone #
        |               |
        v               v
   User confirms in Swish app
        |
        v
Swish --> swish-callback (Edge Function)
        |
        v
  Creates tickets/bookings
  Records payment in DB
        |
        v
Frontend polls check-swish-status
        |
        v
  Shows success when PAID
```

### Step-by-Step Implementation

#### 1. Store Certificates as Secrets

The uploaded .p12 file contains the private key and certificate. The .pem file contains the certificate chain. These need to be stored as secrets:

- **SWISH_CERTIFICATE** - The PEM certificate content (from the uploaded .pem file)
- **SWISH_PRIVATE_KEY** - The private key extracted from the .p12 file
- **SWISH_PAYEE_ALIAS** - Your merchant number: `1236032999`

The private key needs to be extracted from the .p12 file. Since there is no passphrase, I will handle this during implementation.

#### 2. Create Database Table: `swish_payments`

A new table to track Swish payment requests and their lifecycle:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| payment_request_id | text | Swish UUID for the payment request |
| member_id | uuid | FK to profiles |
| amount_cents | integer | Amount in ore (SEK cents) |
| currency | text | Default 'SEK' |
| status | text | CREATED / PAID / DECLINED / ERROR / CANCELLED |
| payment_type | text | course / event / tickets / lesson |
| metadata | jsonb | Stores course_id, event_id, ticket_count, etc. |
| swish_callback_data | jsonb | Raw callback data from Swish |
| created_at | timestamptz | When request was created |
| updated_at | timestamptz | When status last changed |

RLS policies:
- Members can read own payments
- Admins can read all

#### 3. Create Edge Function: `create-swish-payment`

This function:
- Authenticates the user
- Accepts: `payment_type`, `amount_cents`, and type-specific metadata (event_id, course_id, ticket_count, etc.)
- Validates the payment (checks capacity, pricing, etc.) same as existing Stripe functions
- Creates a UUID for the payment request
- Calls Swish API v2 PUT endpoint with mTLS
- Stores the payment request in `swish_payments` table
- Returns the Swish payment token (for mobile deep link) and payment_request_id

#### 4. Create Edge Function: `swish-callback`

This is a **public** endpoint (no JWT) that Swish POSTs to when payment status changes:
- Validates the callback data
- Updates `swish_payments` status
- If PAID: executes the fulfillment logic (create tickets, bookings, etc.) -- reuses the same logic from the existing verify functions
- Records payment in the `payments` table

This function must be registered with `verify_jwt = false` in config.toml.

#### 5. Create Edge Function: `check-swish-status`

Frontend polling endpoint:
- Takes `payment_request_id`
- Returns current status from `swish_payments` table
- If PAID, returns success data (ticket_id, booking_id, etc.)

#### 6. Update Frontend: Payment Method Selection

All checkout dialogs need a payment method selector:

**Affected components:**
- `EventTicketPurchaseDialog.tsx` - Event tickets
- `StandaloneTicketPurchaseDialog.tsx` - Klippkort
- Course purchase flow (in `CourseDetail.tsx` / `BundlePurchaseWizard.tsx`)
- `LessonBookingDialog.tsx` - Drop-in lessons

Each will get a toggle/radio to choose between:
- **Kort (Stripe)** - existing flow, redirects to Stripe Checkout
- **Swish** - new flow, opens Swish or shows phone input

The Swish flow from the frontend:
1. Call `create-swish-payment` with payment details
2. On mobile: open `swish://` deep link with the token
3. On desktop: show a "Waiting for payment..." screen with instructions
4. Poll `check-swish-status` every 2-3 seconds
5. On PAID: show success, navigate to tickets page

#### 7. Update Betalningar (Payments) Page

The admin payments page currently only fetches from Stripe. It needs to also fetch Swish payments:
- Query `swish_payments` table for completed Swish payments
- Merge with Stripe payments
- Add "Swish" as a payment method indicator
- Add Swish to the type filter

#### 8. Update PaymentSuccess Page

Add handling for Swish payment completion (redirected from the Swish polling flow).

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/create-swish-payment/index.ts` | Creates Swish payment request |
| `supabase/functions/swish-callback/index.ts` | Receives Swish payment callbacks |
| `supabase/functions/check-swish-status/index.ts` | Frontend polls payment status |

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/config.toml` | Add `verify_jwt = false` for swish-callback |
| `src/components/EventTicketPurchaseDialog.tsx` | Add Swish payment option |
| `src/components/StandaloneTicketPurchaseDialog.tsx` | Add Swish payment option |
| `src/components/LessonBookingDialog.tsx` | Add Swish payment option |
| `src/components/BundlePurchaseWizard.tsx` | Add Swish payment option |
| `src/pages/Betalningar.tsx` | Show Swish payments alongside Stripe |
| `src/pages/PaymentSuccess.tsx` | Handle Swish payment verification |

### Database Migration

```sql
CREATE TABLE swish_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id text NOT NULL UNIQUE,
  member_id uuid NOT NULL REFERENCES profiles(id),
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'SEK',
  status text NOT NULL DEFAULT 'CREATED',
  payment_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  swish_callback_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE swish_payments ENABLE ROW LEVEL SECURITY;

-- Members can view own Swish payments
CREATE POLICY "Members can view own swish payments"
  ON swish_payments FOR SELECT
  USING (member_id = auth.uid());

-- Admins can view all
CREATE POLICY "Admins can view all swish payments"
  ON swish_payments FOR SELECT
  USING (is_admin());

-- Admins can manage all
CREATE POLICY "Admins can manage swish payments"
  ON swish_payments FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
```

### Important Considerations

1. **Certificate handling**: The .p12 file private key will be base64-encoded and stored as a secret. The edge function will decode it at runtime for mTLS.

2. **Callback security**: The swish-callback endpoint is public but validates the payment request ID exists in our database before processing.

3. **Polling fallback**: If the callback fails, the frontend polls `check-swish-status`. We can also query Swish API directly as a fallback.

4. **Mobile detection**: On mobile devices, we open the Swish app directly. On desktop, users enter their phone number in the Swish payment request.

5. **Swish API environment**: Production endpoint is `https://cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests/`

