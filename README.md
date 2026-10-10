# SentriSend

**Pre-flight email validation and gated sending, as a simple HTTP API.**

SentriSend checks an email address *before* you send to it: is the syntax valid, is the domain a known disposable provider, does the domain exist, and can it receive mail? It can also send the message for you and return a signed audit receipt.

- Website and free key: **https://sentrisend.com**
- API base URL: `https://sentrisend.com/api/v1`
- Built by [Bench Tech Audio Ltd](https://benchtechaudio.com)

> This repository holds the public documentation and examples. The service itself is hosted; its source code is not published here.

---

## What it checks

`POST /validate` runs these checks on one address:

| Check | Detail |
|---|---|
| Syntax | The address is a plain `name@domain` address of 3–254 characters. Quoted and internationalised address forms are not supported. |
| Disposable domains | Matched against a bundled list of about 133,600 disposable domains, including their subdomains. |
| Domain exists | A live DNS lookup tells a non-existent domain apart from a domain with no mail records. |
| Can receive mail | Looks for MX records. If there are none, a usable IPv4 A record is accepted as a fallback. An explicit "null MX" (a domain that says it takes no mail) is rejected. |

**What it does not do.** It does not confirm that a particular mailbox exists, it does not contact the recipient's mail server, and it does not detect role accounts (such as `info@`) or suggest typo fixes. A passing result means the domain can receive mail, not that the person's mailbox is real.

**If DNS is slow or unavailable,** the address is allowed with a `MEDIUM` risk score and the reason `DNS_INCONCLUSIVE`, rather than being rejected.

---

## Quick start

1. Get a free key at https://sentrisend.com. Keys start with `ss_live_`. There is one free key per normalised email address (see [Free keys](#free-keys) below).
2. Keep the key secret. Use it from your server, never from browser code.

### Validate an address

```bash
curl -X POST 'https://sentrisend.com/api/v1/validate' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com"}'
```

Allowed (HTTP 200):

```json
{"allowed":true,"disposable":false,"risk_score":"LOW"}
```

Blocked (HTTP 400):

```json
{"allowed":false,"disposable":true,"reason":"DISPOSABLE_DOMAIN","risk_score":"HIGH"}
```

`reason` is `DISPOSABLE_DOMAIN`, `DOMAIN_NOT_FOUND` or `NO_MX_RECORDS` for blocked addresses (HTTP 400), or `DNS_INCONCLUSIVE` for an address that is allowed because DNS could not be checked (HTTP 200, `MEDIUM` risk).

`/validate` accepts the key only as `Authorization: Bearer YOUR_API_KEY`.

### Send an email

```bash
curl -X POST 'https://sentrisend.com/api/v1/send' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: welcome-email-001' \
  -d '{
    "to": "user@example.com",
    "subject": "Welcome",
    "html": "<p>Your account is ready.</p>"
  }'
```

**With a free key, replace `user@example.com` with your own address**, the one you signed up with. Any other recipient returns `403 RECIPIENT_NOT_VERIFIED`.

`/send` runs the same address checks first, plus content-policy and threat-signature checks, then hands the message to the delivery provider. It accepts the key as `Authorization: Bearer …` or as `x-api-key: …` (if both are sent, `x-api-key` is used).

Success (HTTP 200). The values shown are illustrative:

```json
{
  "success": true,
  "status": "DELIVERED",
  "providerId": "PROVIDER_MESSAGE_ID",
  "attempts": 1,
  "complianceProof": "hmac-sha256:v1:<64 hex characters>",
  "receipt": "hmac-sha256:v1:<same value>",
  "riskLevel": "LOW",
  "riskScore": 0,
  "advisories": []
}
```

"Delivered" means **the delivery provider accepted the message**. It is not confirmation that it reached an inbox. `status` can also be `DELIVERED_AFTER_RETRY`; `attempts` is 1 to 3; `providerId` can be `null`.

#### Request fields for `/send`

| Field | Required | Notes |
|---|---|---|
| `to` | Yes | One address, or a non-empty array of addresses. |
| `subject` | Yes | 3–100 characters. |
| `html` | Yes | At least 5 characters. |
| `text` | No | Plain-text alternative. If supplied, at least 1 character. |
| `from` | No | Sender address, with or without a display name. Some sender identities are reserved, and your delivery provider must accept the address. |
| `reply_to` | No | Reply address. |
| `intendedUse` | No | Free-text label. Defaults to `General Notification`. |
| `whiteLabel` | No | Requests white-label sending. It only takes effect if SentriSend has enabled it for your account (see [Pricing](#limits-and-pricing)). |

The request body is limited to 100 KB. The optional `Idempotency-Key` header (1–256 characters from `A–Z a–z 0–9 . _ : -`) makes retries safe: reuse the same value for retries of the same email. If you leave it out, a repeat request is treated as a new email.

---

## Errors

The error format is **not uniform yet** (see the [roadmap](#roadmap)). Check the HTTP status first, then `code` or `status`.

### `/validate`

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `INVALID_EMAIL` | The address is missing or malformed. |
| 400 | *(no code; `allowed: false`)* | A blocked verdict, with a `reason`. |
| 401 | – | Missing or invalid key. |
| 403 | – | Subscription inactive. |
| 429 | `RATE_LIMITED` | Too many requests. Includes a `Retry-After` header and a `retry_after` field. |
| 429 | `QUOTA_EXCEEDED` | Monthly allowance used up. |
| 503 | – | Authentication, quota or rate-limit service unavailable. |

### `/send`

| HTTP | Code | What to do |
|---|---|---|
| 400 | `INVALID_EMAIL`, `DISPOSABLE_DOMAIN_REJECTED`, `DOMAIN_NOT_FOUND`, `NO_MX_RECORDS` | Fix the address. Don't retry unchanged. |
| 403 | `RECIPIENT_NOT_VERIFIED` | Free keys can only send to the key owner's address. |
| 409 | `IDEMPOTENCY_CONFLICT` | That `Idempotency-Key` was already used for different content. |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | The original request is still processing, or its outcome is unconfirmed. Retry with the **same** key, never a new one. |
| 429 | `QUOTA_EXCEEDED` | Monthly allowance used up. |
| 429 | `DAILY_SEND_LIMIT` | Free keys: daily send cap reached; resets at 00:00 UTC. |
| 503 | `IDEMPOTENCY_UNCONFIRMED` | Response has `doNotRetry: true`. Check what happened to the original request first. |

Some responses carry a `status` field instead of a `code`:

| HTTP | `status` | Meaning |
|---|---|---|
| 403 | `BLOCKED`, `BLOCKED_BY_GLOBAL_INTELLIGENCE` | Rejected by a content-policy or threat check. |
| 502 | `DELIVERY_FAILED` | The provider reported a failure. The body has `providerError` and `attempts`. Read the error before deciding whether to retry. |
| 503 | `DELIVERY_UNCONFIRMED` | Response has `doNotRetry: true`. Don't resend blindly. |
| 503 | `AUDIT_UNCONFIRMED` | **The provider already accepted the email. Don't send it again.** |

These tables are not exhaustive. You may also see `401` (missing or invalid key), `403` (inactive subscription), `413` (request body too large), other `400` responses with only `error` and `details`, and other `503` responses with no code.

---

## Free keys

- One free key per normalised email address. Normalisation removes `+tags` on every domain, removes dots only for Gmail and Googlemail addresses, and treats `googlemail.com` as `gmail.com`. So `you+test@example.com` and `you@example.com` count as the same address.
- Sign-up needs a human check and email verification before the key is shown.
- A free key can send only to its owner's address (including those equivalent spellings), and no more than 10 sends per UTC day.

---

## Recommended pattern: fail open

Validation should never be the reason a real person can't sign up. Block only on a definite "no" and let everything else through. Here is an example for a signup form (Node 18+):

```js
export async function checkEmail(email, { apiKey, baseUrl = "https://sentrisend.com/api/v1", timeoutMs = 800 } = {}) {
  try {
    const res = await fetch(`${baseUrl}/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json().catch(() => ({}));

    if (res.status === 200) return { ok: true, verdict: body };
    if (res.status === 400 && body.allowed === false) return { ok: false, reason: body.reason };
    if (res.status === 400 && body.code === "INVALID_EMAIL") return { ok: false, reason: "INVALID_EMAIL" };
    return { ok: true, skipped: true, status: res.status };   // 401, 403, 429, 503 ...: don't block your user
  } catch {
    return { ok: true, skipped: true };                        // timeout or network error: don't block your user
  }
}
```

The same file is in [`examples/validate-signup.mjs`](examples/validate-signup.mjs), with a test you can run yourself: `node examples/validate-signup.test.mjs`. The test uses a local mock server and covers success, each blocked reason, invalid input, authentication failure, rate limiting, server errors, non-JSON replies and timeouts. It has not been run against the live service.

A blocked verdict is an automated judgement about the domain. Occasionally it will be wrong for a real address, so give people a way to contact you if they are rejected.

---

## Limits and pricing

| Plan | Price | Allowance |
|---|---|---|
| **Free** | $0 | 100 requests a month, shared between `/validate` calls and sends accepted by the delivery provider. Sends only to your own address, maximum 10 sends per UTC day. |
| **Pro** | $29 per month | 50,000 requests a month, shared between `/validate` calls and sends. No daily send cap. |
| **Enterprise** | $299 per month (listed) | Limits are set per key by SentriSend. There is no self-serve checkout yet; use the contact option on the website. |

**White-label.** Removing the SentriSend footer is enabled manually by SentriSend for an account. It is not switched on automatically by subscribing to Pro.

Every admitted `/validate` call uses one unit, including blocked, repeated and malformed-input calls. A send accepted by the provider uses one unit. A replay of a completed idempotent `/send` uses no extra unit.

`/validate` is rate limited per key (bursts of 20, refilling 2 a second) and per IP address (bursts of 100, refilling 10 a second).

Prices and allowances are set on https://sentrisend.com and may change.

---

## Audit receipts and your data

**Receipts.** Every **successful** send returns a `complianceProof`: an HMAC-SHA256 value computed on the server over your request as submitted: recipient, subject, HTML, text, sender, reply-to, intended use, the white-label flag in the request body and the idempotency key. It gives you a tamper-evident reference for that request.

Its limits: it covers your request **before** SentriSend adds its footer or any financial seal, and it does not cover the provider's acceptance details. **It cannot be checked independently today**, because the signing secret stays on the server, and there is no public endpoint for verifying send receipts.

**What is stored.**

- **`/validate`:** submitted addresses are not persisted in application records. Only quota counters and rate-limit records keyed by hashed key and IP identifiers (not raw IP addresses) are kept.
- **`/send`:** the audit record keeps the event type, timestamp, risk reasons, the HMAC receipt and a payload snapshot. In that snapshot the recipient, reply-to address and message bodies (HTML and text) are replaced with redaction markers, but **the subject, the sender and the intended use are kept as written**. Idempotency records keep a fingerprint of the request, the HTTP status and the response that was returned.
- **Provider error messages** are recorded as received. If a provider repeats an address or other submitted text in an error, that text can be retained.
- Your delivery provider necessarily receives the recipient, subject and body in order to send the message.
- No fixed retention period for audit records has been set yet, and this page doesn't describe what external infrastructure or providers retain.

Don't put secrets or sensitive personal data in subject lines.

---

## Financial attestation (beta)

An optional add-on for businesses that email payment details. It is available only for approved account and sender-domain pairs, and identity approval currently supports UK (GB) businesses only. For an approved sender, SentriSend extracts the supported financial details from the message (not arbitrary content), stores a keyed fingerprint, and adds a verification seal that recipients can check at `https://sentrisend.com/verify/<proof_hash>`.

It confirms that **the details in a message match what was recorded for that attested request**. The record is stored before the message is handed to the delivery provider, so it is not proof that the email was sent or delivered. It is also not independent verification of the sender's identity or of the legitimacy of the payment details, and recipients should confirm payment details through a separate channel. Treat it as beta.

---

## Roadmap

These are **not available yet**. They are listed so you know what to expect, not as features.

- Caching of DNS lookups between requests. Today, every validation of a well-formed, non-disposable address does a fresh lookup.
- Automatic daily updates of the disposable-domain list. It is currently bundled at build time and updated by release.
- An installable npm package. A TypeScript client exists but is not published.
- A Supabase Auth "Send Email" hook example, tested against a live Supabase project.
- Standard `X-RateLimit-*` response headers and a single uniform error format across endpoints.
- A public way to verify send receipts.
- Self-serve Enterprise checkout.
- Verified production latency figures. None are available yet.
- Native-speaker review of the Japanese, Korean, Simplified Chinese and Traditional Chinese (Hong Kong) pages. The site is available in these languages, and corrections are welcome.

---

## Support and security

- Questions and bug reports: open a [GitHub issue](../../issues).
- **Security issues:** please don't post them in a public issue. Use this repository's private reporting: **Security → Report a vulnerability**.

## Licence

The documentation and examples in this repository are released under the MIT licence (see `LICENSE`). The licence covers only the files in this repository.
