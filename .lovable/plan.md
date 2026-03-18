
A. Exact current failure

- Frontend path confirmed:
  `src/components/EventTicketPurchaseDialog.tsx:129-142`
  - Swish button → `handlePurchase()`
  - Calls `supabase.functions.invoke('create-swish-payment', ...)`
- Edge Function confirmed:
  `supabase/functions/create-swish-payment/index.ts`
- Latest real function result:
  - Edge Function HTTP status to frontend: `500`
  - Frontend then shows: `Edge Function returned a non-2xx status code`

B. Exact code location

- Frontend call site:
  `src/components/EventTicketPurchaseDialog.tsx:130`
- Outbound Swish request in backend:
  `supabase/functions/create-swish-payment/index.ts:160-166`
- Exact failing stack from logs:
```text
TypeError: error sending request from 10.32.82.211:33516 for https://cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests/CA47C707BF9448B1889B238FAA9EB44F (213.132.115.86:443): client error (SendRequest): connection error: cannot decrypt peer's message
    at mainFetch (ext:deno_fetch/26_fetch.js:204:11)
    at async fetch (ext:deno_fetch/26_fetch.js:488:11)
    at async Server.<anonymous> (file:///var/tmp/sb-compile-edge-runtime/create-swish-payment/index.ts:140:27)
Caused by Error: cannot decrypt peer's message
```

C. Root cause

The real current blocker is no longer missing secrets and no longer PEM parsing.

The function now gets past all of this successfully:
- request auth
- request body parsing
- payload construction
- secret loading
- PEM canonicalization
- `Deno.createHttpClient(...)`

The failure happens only when the function actually tries to open the TLS connection to Swish.

D. Why it fails technically

Real log sequence proves this:
1. `User: ... Type: event Amount: 170`
2. `Payload built`
3. `Creating HTTP client...`
4. `HTTP client created successfully`
5. `Calling Swish API...`
6. TLS/network failure: `cannot decrypt peer's message`

That means:

- malformed request body: no
- missing/incorrect env var: no
- bad PEM parsing: no longer the current failure
- certificate loading problem: no longer the current failure
- client certificate attached at code level: yes, because `createHttpClient()` succeeded and fetch used `client: httpClient`
- fetch/network failure to Swish: yes
- wrong Swish endpoint: not proven, and not the current blocker because handshake fails before HTTP
- callbackUrl issue: no, callback is not reached yet
- wrong payload to Swish: not current blocker because Swish never returns an HTTP response
- unsupported TLS/client-cert behavior in this Edge runtime: this is now the leading issue

In short: the app is now failing in the TLS handshake layer between the Edge runtime and Swish, not in your application logic.

E. Exact issue

Your current backend runtime can build the mTLS client, but the outbound TLS session to `cpc.getswish.net` fails during handshake with:
`cannot decrypt peer's message`

That is a runtime-level mTLS/TLS compatibility failure. The strongest explanation is incompatibility between the Edge runtime TLS stack (`Deno`/`rustls`) and what the Swish endpoint expects during handshake. This is consistent with known `rustls` limitations around some mTLS server setups.

I cannot prove from these logs whether the server is requiring renegotiation specifically, but I can prove the failure is below HTTP and above your app code.

F. Smallest correct fix

The smallest correct fix is architectural, not another PEM tweak:

1. Keep the frontend unchanged.
2. Stop making the direct Swish mTLS call from `create-swish-payment` in the Edge runtime.
3. Move only the Swish outbound request to a runtime with an OpenSSL-based TLS stack (for example: a tiny Node/OpenSSL service, Cloud Run, Azure Function, VPS, or existing backend you control).
4. Let `create-swish-payment` call that proxy/service instead, then continue saving the payment row in your current backend.

Why this is the smallest correct fix:
- the current code already proves cert parsing and client creation work
- the remaining failure is in the runtime TLS handshake itself
- another in-function formatting tweak is unlikely to solve a transport-layer incompatibility

G. What would change in implementation

I would change only the Swish transport layer:

- Keep:
  - `src/components/EventTicketPurchaseDialog.tsx`
  - request body format
  - payment table insert flow
  - current polling/status UI
- Change:
  - `supabase/functions/create-swish-payment/index.ts`
    - replace direct `fetch(..., { client: httpClient })` to Swish
    - call a secure external Swish proxy instead
- Add:
  - proxy URL/token secrets if needed

H. Important secondary detail to verify after that

There is one config inconsistency worth checking after the handshake blocker is removed:
- current code uses `PAYEE_ALIAS = "1230344705"`
- project memory mentions `1236032999`

This is not the current failure, because the request never gets far enough for Swish to validate it, but it should be verified before go-live.

I. Confidence level

High.

Why:
- the latest logs are unambiguous
- `createHttpClient()` succeeds
- the exact failing line is the outbound `fetch()` to Swish
- the error is a TLS handshake error, not an app/data error
- that rules out the frontend, request body, env secret presence, and previous PEM parsing bug as the current blocker
