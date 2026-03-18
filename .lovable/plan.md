

# Swish mTLS Proxy — Architecture & Implementation Plan

## A. Architecture

```text
┌──────────┐      ┌─────────────────────┐      ┌───────────────────┐      ┌──────────────┐
│ Frontend │─────▶│ Supabase Edge Func  │─────▶│ Railway Node.js   │─────▶│ Swish API    │
│ (React)  │      │ create-swish-payment│      │ Proxy (OpenSSL)   │      │ cpc.getswish │
│          │      │ - auth, DB insert   │      │ - mTLS handshake  │      │              │
│          │      │ - calls proxy       │      │ - forwards PUT    │      │              │
└──────────┘      └─────────────────────┘      └───────────────────┘      └──────────────┘
                         │                            │
                         │ SWISH_PROXY_TOKEN           │ SWISH_CERT, SWISH_KEY, SWISH_CA
                         │ (shared secret)             │ (stored on Railway only)
```

- **Frontend**: unchanged. Still calls the same Edge Function.
- **Edge Function**: keeps auth, payload building, DB insert. Replaces direct Swish `fetch` with a call to the Railway proxy.
- **Railway proxy**: tiny Express server that receives the Swish payload, makes the mTLS call using Node.js `https` (OpenSSL), returns the result.
- **Certs**: only exist on Railway. Never on frontend, never passed over the wire.

## B. Files to Create (Railway project — separate repo)

The proxy is a **separate repository** deployed to Railway. Three files total:

### 1. `package.json`
```json
{
  "name": "swish-mtls-proxy",
  "version": "1.0.0",
  "scripts": { "start": "node index.js" },
  "dependencies": { "express": "^4.18.2" }
}
```

### 2. `index.js`
```javascript
const express = require("express");
const https = require("https");

const app = express();
app.use(express.json());

const PROXY_TOKEN = process.env.PROXY_TOKEN;
const SWISH_CERT = process.env.SWISH_CERT;
const SWISH_KEY = process.env.SWISH_KEY;
const SWISH_CA = process.env.SWISH_CA;
const PORT = process.env.PORT || 3000;

// Simple rate limiter: max 30 requests per minute per IP
const rateMap = new Map();
function rateLimit(req, res, next) {
  const ip = req.headers["x-forwarded-for"] || req.ip;
  const now = Date.now();
  const window = 60000;
  const max = 30;
  const hits = (rateMap.get(ip) || []).filter(t => t > now - window);
  if (hits.length >= max) return res.status(429).json({ error: "Too many requests" });
  hits.push(now);
  rateMap.set(ip, hits);
  next();
}

app.use(rateLimit);

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// Swish proxy endpoint
app.put("/swish/paymentrequests/:id", (req, res) => {
  // Verify shared secret
  const token = req.headers["x-proxy-token"];
  if (!token || token !== PROXY_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const paymentId = req.params.id;
  const body = JSON.stringify(req.body);

  const url = new URL(
    `https://cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests/${paymentId}`
  );

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
    cert: SWISH_CERT,
    key: SWISH_KEY,
    ca: SWISH_CA,
  };

  const swishReq = https.request(options, (swishRes) => {
    let data = "";
    swishRes.on("data", (chunk) => (data += chunk));
    swishRes.on("end", () => {
      console.log(`[proxy] Swish ${swishRes.statusCode} for ${paymentId}`);
      res.status(swishRes.statusCode);
      // Forward Location header if present
      if (swishRes.headers.location) {
        res.set("location", swishRes.headers.location);
      }
      // Forward paymentrequesttoken header if present
      if (swishRes.headers.paymentrequesttoken) {
        res.set("paymentrequesttoken", swishRes.headers.paymentrequesttoken);
      }
      if (data) {
        try { res.json(JSON.parse(data)); }
        catch { res.send(data); }
      } else {
        res.end();
      }
    });
  });

  swishReq.on("error", (err) => {
    console.error("[proxy] Swish request error:", err.message);
    res.status(502).json({ error: "Swish connection failed", detail: err.message });
  });

  swishReq.write(body);
  swishReq.end();
});

app.listen(PORT, () => console.log(`Swish proxy running on port ${PORT}`));
```

### 3. `Procfile` (optional but good practice)
```
web: node index.js
```

## C. Environment Variables on Railway

| Variable | Value | Source |
|---|---|---|
| `PROXY_TOKEN` | Generate a strong random token (e.g. `openssl rand -hex 32`) | You create this |
| `SWISH_CERT` | Full PEM content of your Swish client certificate | Same as current `SWISH_CERT` secret |
| `SWISH_KEY` | Full PEM content of your Swish private key | Same as current `SWISH_KEY` secret |
| `SWISH_CA` | Full PEM content of Swish CA certificate(s) | Same as current `SWISH_CA` secret |
| `PORT` | Railway sets this automatically | Auto |

## D. Railway Deployment Steps

1. **Create a GitHub repo** with the 3 files above (`package.json`, `index.js`, `Procfile`)
2. Go to [railway.app](https://railway.app) → Sign up / log in
3. Click **"New Project"** → **"Deploy from GitHub repo"** → select your repo
4. Railway auto-detects Node.js, runs `npm install && npm start`
5. Go to **Settings → Networking** → click **"Generate Domain"** → you get a URL like `https://swish-proxy-production-xxxx.up.railway.app`
6. Go to **Variables** tab → add `PROXY_TOKEN`, `SWISH_CERT`, `SWISH_KEY`, `SWISH_CA`
   - For multi-line PEM values: paste the full PEM content including `-----BEGIN...` and `-----END...` lines
7. Railway redeploys automatically
8. Test: `curl https://YOUR-RAILWAY-URL/health` → should return `{"ok":true}`

**Cost**: Railway free tier gives 500 hours/month + $5/month hobby plan is more than enough for this.

## E. Supabase Changes

### 1. Add two new secrets

| Secret name | Value |
|---|---|
| `SWISH_PROXY_URL` | `https://swish-proxy-production-xxxx.up.railway.app` (your Railway URL) |
| `SWISH_PROXY_TOKEN` | Same token you set as `PROXY_TOKEN` on Railway |

### 2. Rewrite `create-swish-payment` Edge Function

Remove all PEM handling and `Deno.createHttpClient`. Replace the Swish fetch block with a simple `fetch` to the proxy. Everything else stays the same (auth, payload building, DB insert).

Key change — replace lines 120–183 (cert loading + mTLS client + Swish fetch) with:

```typescript
// Call Swish via proxy
const proxyUrl = Deno.env.get("SWISH_PROXY_URL");
const proxyToken = Deno.env.get("SWISH_PROXY_TOKEN");

if (!proxyUrl || !proxyToken) {
  throw new Error("Missing SWISH_PROXY_URL or SWISH_PROXY_TOKEN");
}

console.log("[create-swish-payment] Calling Swish proxy...");
const swishResponse = await fetch(
  `${proxyUrl}/swish/paymentrequests/${paymentRequestId}`,
  {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Proxy-Token": proxyToken,
    },
    body: JSON.stringify(swishPayload),
  }
);

console.log("[create-swish-payment] Proxy response status:", swishResponse.status);
```

The rest of the response handling (status check, token extraction, DB insert) stays identical.

Also remove:
- `canonicalizeSinglePem` function
- `extractAndCanonicalizeBlocks` function
- All `SWISH_CERT`, `SWISH_KEY`, `SWISH_CA` env reads
- `Deno.createHttpClient` call
- `httpClient.close()` call

### 3. Optionally clean up secrets

`SWISH_CERT`, `SWISH_KEY`, `SWISH_CA` can be removed from Supabase secrets after the proxy is live (they now live on Railway only).

## F. Test Steps

1. Deploy the proxy to Railway
2. Verify health: `curl https://YOUR-URL/health`
3. Add `SWISH_PROXY_URL` and `SWISH_PROXY_TOKEN` secrets to Supabase
4. Deploy the updated Edge Function
5. Trigger a Swish payment from the app (event ticket purchase)
6. Check Edge Function logs for:
   - `Calling Swish proxy...`
   - `Proxy response status: 201`
7. Check Railway logs for:
   - `Swish 201 for <paymentId>`
8. Verify the `SwishPaymentStatus` dialog appears and polls correctly
9. If Swish returns a non-201, the Railway logs will show the exact Swish error for debugging

## G. PAYEE_ALIAS Check

Current code has `1230344705`. Project memory says `1236032999`. Verify which is correct before going live — this doesn't affect the proxy architecture but will cause Swish to reject the payment if wrong.

