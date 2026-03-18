
Issue found: the request is still failing before it ever reaches Swish. This is not a frontend bug now.

## What is actually happening

**A. Button click flow**
- `src/components/EventTicketPurchaseDialog.tsx`
- `handlePurchase()` → `if (paymentMethod === 'swish')`
- Calls:
  `supabase.functions.invoke('create-swish-payment', { body: { payment_type, amount_sek, metadata } })`

**B. Edge Function**
- `create-swish-payment`

**C. Current request payload**
```json
{
  "payment_type": "event",
  "amount_sek": 170,
  "metadata": {
    "event_id": "...",
    "ticket_count": "1|2|3",
    "attendee_names": "[...]",
    "message": "event title"
  }
}
```

**D. Current response handling**
- Frontend throws when `invoke()` gets a non-2xx response
- That becomes the generic toast:
  `Edge Function returned a non-2xx status code`

## Real backend failure from logs

**HTTP status returned by function**
- `500`

**Exact error**
```text
TypeError: Unable to add pem file to certificate store:
section end "-----END CERTIFICATE----- MIIFzT... -----END CERTIFICATE-----" missing
```

**Stack trace**
```text
at Object.createHttpClient (ext:deno_fetch/22_http_client.js:30:5)
at Server.<anonymous> (file:///var/tmp/sb-compile-edge-runtime/create-swish-payment/index.ts:122:29)
```

**Exact code location**
- Current file: `supabase/functions/create-swish-payment/index.ts`
- Failing call: `Deno.createHttpClient(...)` at the mTLS setup block (current repo lines ~130-136; deployed stack shows line 122 from the deployed build)

## Root cause

The PEM material is still malformed **at runtime formatting level** when passed into `Deno.createHttpClient`.

This means:
- not malformed frontend body
- not missing secret names
- not Swish endpoint yet
- not callback URL yet
- not outbound fetch yet

The failure is specifically in the certificate/client creation step.

## Why it fails technically

Current helper behavior is still too weak:
- `normalizePem()` returns the secret **as-is** if it already starts with `-----BEGIN`
- that preserves bad formatting if the stored secret has collapsed whitespace / flattened PEM content
- `extractPemBlocks()` splits the CA bundle, but it does **not** canonicalize each block before passing it to `createHttpClient`

So the function is trying to create an mTLS client with PEM text that still is not in a parseable certificate-store format.

Important: this does **not** prove the backend runtime cannot do mTLS. It proves the runtime is rejecting the PEM text being supplied.

## Smallest correct fix

1. Keep the frontend unchanged.
2. Patch only `supabase/functions/create-swish-payment/index.ts`.
3. Replace the PEM handling with a **strict canonicalizer**:
   - always extract PEM body
   - strip internal whitespace
   - rebuild with proper header/footer
   - wrap base64 at 64 chars per line
4. Apply that canonicalization to:
   - `SWISH_CERT`
   - `SWISH_KEY`
   - **each** CA cert block individually
5. Add one more precise log:
   - cert block count
   - whether each block was rebuilt
   - lengths only, not secret contents

## Planned implementation

- Add a stricter helper that normalizes even already-marked PEM blocks
- Normalize CA bundle block-by-block before `caCerts` is passed to `Deno.createHttpClient`
- Keep the current logging and add one validation log just before client creation
- Do not refactor the Swish payload, frontend dialog, or DB insert logic

## Files to change

- `supabase/functions/create-swish-payment/index.ts`

## Expected outcome after patch

One of two things will happen:
1. `Deno.createHttpClient(...)` succeeds, and the request finally reaches Swish
2. A new downstream error appears from Swish itself, which will be the next real blocker

Either way, this patch removes the **current** blocker.

## Technical details

Current failing section:
```ts
const httpClient = Deno.createHttpClient({
  certChain: certPem,
  privateKey: keyPem,
  caCerts: caCerts,
});
```

Reason it fails:
- PEM strings are present
- but at least one cert/key/CA block is still not in valid parseable PEM structure when handed to Deno

## Validation plan after implementation

1. Retry the same event Swish payment
2. Check logs for:
   - `Creating HTTP client...`
   - `HTTP client created successfully`
   - `Calling Swish API...`
3. If that appears, the PEM issue is fixed
4. Then inspect the first real Swish response, if any

Confidence: high. The logs isolate the failure to certificate parsing inside `createHttpClient`, before any network call to Swish.
