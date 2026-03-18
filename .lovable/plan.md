

# Fix: Swish Payment — Missing mTLS Certificates

## Root Cause (confirmed from logs + secrets list)

The `create-swish-payment` edge function crashes at line 85 with:
```
TypeError: Cannot read properties of undefined (reading 'trim')
```

Because `Deno.env.get("SWISH_CERT")` returns `undefined` — the three mTLS secrets (`SWISH_CERT`, `SWISH_KEY`, `SWISH_CA`) were never added to the project secrets.

## What Needs to Happen

### Step 1: Add the three Swish certificate secrets
You need to provide the PEM contents for:
- **SWISH_CERT** — Your Swish client certificate (from Nordea/Swish merchant portal)
- **SWISH_KEY** — The private key matching that certificate
- **SWISH_CA** — The Swish CA root certificate (Swish provides this)

These are the mTLS credentials Nordea issued for your payee alias `1230344705`.

### Step 2: Add defensive error handling in the edge function
A small code change to give clear error messages if any secret is missing, instead of crashing with a cryptic TypeError:

```typescript
const certRaw = Deno.env.get("SWISH_CERT");
const keyRaw = Deno.env.get("SWISH_KEY");
const caRaw = Deno.env.get("SWISH_CA");

if (!certRaw || !keyRaw || !caRaw) {
  const missing = [
    !certRaw && "SWISH_CERT",
    !keyRaw && "SWISH_KEY",
    !caRaw && "SWISH_CA",
  ].filter(Boolean);
  throw new Error(`Missing Swish certificate secrets: ${missing.join(", ")}`);
}

const certPem = ensurePem(certRaw, "CERTIFICATE");
const keyPem = ensurePem(keyRaw, "PRIVATE KEY");
const caPem = ensurePem(caRaw, "CERTIFICATE");
```

### Files Changed
- **`supabase/functions/create-swish-payment/index.ts`** — Add null checks before `ensurePem` calls (lines 83-87)

### No other changes needed
The frontend code, payload structure, callback URL, and Swish API endpoint are all correct. The only issue is missing secrets.

