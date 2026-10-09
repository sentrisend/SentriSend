# SentriSend

> **Stateless Pre-Flight Email Security Gateway for Transactional Infrastructure**  
> *Intercept bot signup floods and disposable domains in-memory before they trigger AWS SES bounce bans.*

[![Status](https://img.shields.io/badge/API_Tests-80%2F80_Passed-10b981?style=flat-square)](https://sentrisend.com)
[![Architecture](https://img.shields.io/badge/Architecture-Stateless_Zero--PII-0ea5e9?style=flat-square)](https://sentrisend.com)
[![Latency](https://img.shields.io/badge/Preflight_Latency-%3C2ms_In--Memory-f59e0b?style=flat-square)](https://sentrisend.com)
[![Reliability](https://img.shields.io/badge/Reliability-Fail--Open_Supported-6366f1?style=flat-square)](https://sentrisend.com)
[![Procurement](https://img.shields.io/badge/Procurement-UK_.gov_Vendor_Listed-10b981?style=flat-square)](https://sentrisend.com)

---

## ⚡ The Problem: The AWS SES 5% Bounce Cliff

Most SaaS applications treat transactional email as background plumbing until an automated bot script hits their `/signup` or password-reset route with dead or disposable emails.

1. **The Attack:** A bot injects 100–200 invalid/honeypot emails into your auth endpoint.
2. **The Hard Bounce Wave:** Upstream providers (AWS SES, Resend, SendGrid) dispatch to dead mailboxes and record hard bounces.
3. **The 5% Red Line:** AWS SES places accounts with bounce rates exceeding **5% on immediate probation** and shuts off sending completely at **10%**.
4. **The Critical Outage:** Real customers stop receiving login links, verification tokens, and Stripe payment receipts.

> **Retrospective suppression lists (SNS/SQS) fail to prevent this** because the reputation damage is recorded the exact millisecond the email leaves the upstream server.

---

## 🛡️ Pre-Flight Gateway Architecture

SentriSend sits as a lightweight, pre-flight security layer between your application backend and your sending provider:

```text
[ Supabase Auth / Next.js / Backend ]
                  │
                  ▼
   [ SentriSend Pre-Flight Gateway ] ──(In-memory screening in <2ms)
                  │
    ┌─────────────┴─────────────────────────────┐
    ▼                                           ▼
[ Disposable / Bot Payload ]            [ Verified Real Address ]
    ➔ Blocked with HTTP 400                 ➔ Dispatched via AWS SES / Resend
    ➔ SES Never Invoked                     ➔ Bounce Rate Stays at 0.0%
```

---

## 🚀 30-Second Quickstart (cURL)

Test the pre-flight gateway directly from your terminal using our default verified sandbox sender (zero domain setup required):

```bash
curl -X POST https://sentrisend.com/api/v1/send \
  -H "Authorization: Bearer ss_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "developer@company.com",
    "subject": "SentriSend Gateway Verification",
    "html": "<p>SentriSend pre-flight threat protection verified.</p>",
    "from": "SentriSend Sandbox <sandbox@sentrisend.com>",
    "reply_to": "developer@company.com"
  }'
```

### Response (HTTP 200 OK):
```json
{
  "success": true,
  "receipt": "hmac-sha256:v1:8f2a4b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a",
  "dispatched_at": "2026-10-08T10:00:00Z"
}
```

---

## 🔒 Next.js / Supabase Auth Integration (With Fail-Open Mode)

Protect your Supabase Auth endpoints from bot signup floods while ensuring your authentication flow **never** goes down:

```typescript
// pages/api/auth/send-verification.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email, token, type } = req.body;

  try {
    // 1. Pre-flight check via SentriSend
    const response = await fetch('https://sentrisend.com/api/v1/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENTRISEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `auth_${type}_${Date.now()}`
      },
      body: JSON.stringify({
        to: email,
        subject: type === 'signup' ? 'Verify your account' : 'Reset your password',
        html: `<p>Your verification code is: <strong>${token}</strong></p>`,
        from: 'SentriSend Sandbox <sandbox@sentrisend.com>',
        reply_to: 'support@yourdomain.com'
      })
    });

    const result = await response.json();

    if (!response.ok) {
      // Disposable domain or bot payload rejected BEFORE touching SES
      console.warn(`[SentriSend Blocked]: ${result.error}`);
      return res.status(400).json({ error: 'Disposable or high-risk email address rejected' });
    }

    return res.status(200).json({ success: true, receipt: result.receipt });

  } catch (error) {
    // 2. Fail-Open Architecture: If gateway times out, fail open to direct dispatch
    // ensuring user authentication is NEVER blocked by network hiccups.
    console.warn('[SentriSend Gateway Unreachable - Failing Open to SES]:', error);
    await fallbackDirectSend({ to: email, token });
    return res.status(200).json({ success: true, fallback: true });
  }
}
```

---

## ⏱️ Performance Benchmarks: The Pre-Flight Edge

Traditional email validation services (ZeroBounce, Kickbox) rely on active external SMTP `RCPT TO` network handshakes, adding **300ms to 800ms of latency** and risking IP tarpits.

SentriSend operates on an **in-memory, stateless evaluation engine**:
* **Pre-flight screening latency:** **< 2ms**
* **Disposable domain dataset:** Maintained in-memory; zero network hops.
* **Database write guarantee:** Full HMAC-SHA256 audit write confirmed before HTTP 200 is returned.

---

## 🔄 Fail-Open Reliability Guarantee

We know putting a security gateway in your authentication pipeline requires absolute trust:
* **Sub-200ms Execution Timeout:** If an evaluation exceeds 200ms, our SDKs support immediate **Fail-Open**, routing directly to your backup provider so users can always log in.
* **Deterministic Responses:** Structured HTTP 429 (`QUOTA_EXCEEDED`) and HTTP 503 (`AUDIT_UNCONFIRMED`) error codes prevent unhandled server exceptions and duplicate dispatch floods.

---

## 📜 Stateless Zero-PII Compliance

* **Zero PII Stored:** SentriSend does not persist recipient email addresses, user identities, or message content in database logs.
* **Cryptographic HMAC Receipts:** Every processed dispatch generates an immutable SHA-256 HMAC compliance proof (`hmac-sha256:v1:...`) enabling legal verification for **UK GDPR**, **CCPA**, and **PIPA** without data retention liabilities.
* **Official Registry:** Listed on the **UK .gov official vendor directory**.

---

## 🏛️ Enterprise Add-On: Statutory Financial Attestation (BEC Defense)

For corporate billing and high-liability finance workflows:
* **Coordinate Interception:** Automatically scans outgoing invoices for banking coordinates (Sort Codes, Account Numbers, IBANs, amounts).
* **Statutory Registry Binding:** Cryptographically binds coordinates to statutory corporate records (**UK Companies House No. 17412179**).
* **Public Verifier:** Generates a tamper-evident emerald seal and verification link (`sentrisend.com/verify/:proof_hash`) to eliminate invoice redirection fraud (Vendor Email Compromise).

---

## 🔑 Free Developer Sandbox

Get an active sandbox key with 100 free requests/month (no credit card required):  
👉 **[https://sentrisend.com/supabase](https://sentrisend.com/supabase)**

---

## 🏢 Corporate & Licensing

* **Parent Entity:** Bench Tech Audio Ltd (Company No: 17412179, England & Wales)
* **Registered Office:** Unit A, 82 James Carter Road, Mildenhall, Suffolk, IP28 7DE, UK
* **Founder & Lead Systems Architect:** Steve Danby