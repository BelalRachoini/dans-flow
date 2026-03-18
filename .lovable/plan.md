
A. Exact current failure

- The failing flow is the event-ticket Swish purchase path:
  `src/components/EventTicketPurchaseDialog.tsx` → `handlePurchase()` → branch `if (paymentMethod === 'swish')` → `supabase.functions.invoke('create-swish-payment', ...)`.
- The latest failed backend invocation is confirmed by logs:
  - payment type: `event`
  - amount: `170`
- The Edge Function returns HTTP `500`.
- Exact logged error:
  `TypeError: Unable to add pem file to certificate store: InvalidByte(1986, 61)`
- Stack trace from real logs:
  ```text
  TypeError: Unable to add pem file to certificate store: InvalidByte(1986, 61)
      at Object.createHttpClient (ext:deno_fetch/22_http_client.js:30:5)
      at Server.<anonymous> (file:///var/tmp/sb-compile-edge-runtime/create-swish-payment/index.ts:101:29)
      at eventLoopTick (ext:core/01_core.js:175:7)
      at async Server.#respond (https://deno.land/std@0.190.0/http/server.ts:220:18)
  ```

B. Exact code location

Frontend request:
- `src/components/EventTicketPurchaseDialog.tsx:129-141`

Current request body sent from frontend:
```json
{
  "payment_type": "event",
  "amount_sek": 170,
  "metadata": {
    "event_id": "event.id",
    "ticket_count": "selectedOption",
    "attendee_names": "JSON string of attendee names",
    "message": "event title truncated to 50 chars"
  }
}
```

Current response handling:
- `src/components/EventTicketPurchaseDialog.tsx:142-155`
- If `invoke()` returns an error, it is thrown and shown as:
  `toast.error(error.message || t.common.error)`
- That is why the UI shows the generic:
  `Edge Function returned a non-2xx status code`

Backend failure point:
- `supabase/functions/create-swish-payment/index.ts`
- Failing statement is the `Deno.createHttpClient(...)` call:
  ```ts
  const httpClient = Deno.createHttpClient({
    certChain: certPem,
    privateKey: keyPem,
    caCerts: [caPem],
  });
  ```

C. Root cause

This is no longer a missing-secret issue.

The real blocker is a PEM parsing/certificate-loading failure before the Swish HTTP request is made.

The failure is caused by the current `ensurePem()` helper flattening PEM content too aggressively:
- it removes all PEM headers/footers
- removes all whitespace
- rejoins everything into one single `BEGIN/END` block

That breaks certificate bundles/chains. If `SWISH_CA` (or another cert secret) contains more than one PEM block, the helper merges them into one invalid certificate body. The error byte `61` is `=`, which strongly matches broken base64 padding appearing in the middle of a merged PEM body.

So the actual classification is:
- not malformed frontend request body
- not missing env vars
- yes bad PEM parsing
- yes certificate loading problem
- not fetch/network to Swish
- not wrong Swish endpoint
- not callback URL
- not payload to Swish
- not proven unsupported mTLS in backend runtime

D. Why it fails technically

The request never reaches Swish.

Execution order from real code + real logs:
1. Auth succeeds
2. Request JSON is parsed
3. Swish payload is built
4. Secrets are loaded
5. `ensurePem()` transforms cert/key/CA strings
6. `Deno.createHttpClient(...)` tries to load the CA/cert material
7. Runtime throws while parsing PEM
8. Catch block returns HTTP `500`

So:
- mTLS is intended to be attached correctly in code via `client: httpClient`
- but the client is never created successfully
- therefore no outbound Swish call happens at all

The current code does attempt to use the client certificate:
```ts
const swishResponse = await fetch(..., {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(swishPayload),
  client: httpClient,
});
```
So the architecture is basically correct for this stage; the blocker is the malformed PEM handling before `fetch()`.

E. Exact fix

Smallest correct fix:
1. Stop collapsing existing PEM bundles into a single certificate.
2. Preserve PEM blocks if the secret already contains `-----BEGIN ...-----`.
3. Split CA bundles into individual cert blocks for `caCerts`.
4. Add targeted logs around:
   - request received
   - payload built
   - secret presence
   - PEM block counts / whether PEM markers were detected
   - HTTP client creation start/success
   - fetch start
   - Swish response status/body
   - DB insert start/success

Implementation approach:
- Replace `ensurePem()` with two safer helpers:
  - one that preserves existing PEM blocks
  - one that extracts multiple PEM certificates from a bundle for `caCerts`
- Keep `certChain` and `privateKey` in PEM form without flattening multiple blocks into one blob
- Pass `caCerts` as an array of real PEM cert blocks, not one reconstructed blob

F. Files changed

Only one file needs to change:
- `supabase/functions/create-swish-payment/index.ts`

No frontend changes are needed for this blocker.

G. Final test steps

After patching:
1. Trigger the same event-ticket Swish purchase flow from `EventTicketPurchaseDialog`
2. Confirm logs now show:
   - payload built
   - PEM detected
   - CA cert count
   - HTTP client created successfully
3. Confirm either:
   - Swish returns `201` and payment request is created
   - or a new downstream Swish error appears, which would then be the next real blocker
4. Verify frontend opens `SwishPaymentStatus` instead of showing the generic non-2xx toast

H. Confidence level

High.

Reason:
- The real failure is directly confirmed by logs
- the exact failing statement is identified
- the failure occurs before `fetch()`
- the error shape matches the current PEM-normalization logic corrupting bundled PEM content
- this is the smallest targeted fix without refactoring unrelated code
