# SentriSend

> **Stateless Outbound Email Security Gateway & Financial Attestation Enclave**  
> *Pre-flight threat defense preventing AWS SES bounce bans, bot flood suspensions, and invoice redirection fraud.*

[![Status](https://img.shields.io/badge/API_Tests-80%2F80_Passed-10b981?style=flat-square)](https://sentrisend.com)
[![Architecture](https://img.shields.io/badge/Architecture-Stateless_Zero--PII-0ea5e9?style=flat-square)](https://sentrisend.com)
[![Compliance](https://img.shields.io/badge/Compliance-UK_.gov_Vendor_Listed-10b981?style=flat-square)](https://sentrisend.com)
[![Statutory Seal](https://img.shields.io/badge/Companies_House-17412179-6366f1?style=flat-square)](https://sentrisend.com)
[![Latency](https://img.shields.io/badge/Preflight_Latency-%3C2ms-f59e0b?style=flat-square)](https://sentrisend.com)

---

## ⚡ The Problem: The AWS SES 5% Bounce Cliff

Most SaaS applications treat transactional email as background plumbing until an automated bot script hits their `/signup` or password-reset route with disposable emails.

1. **The Asymmetric Threat:** A bot injects 200 invalid/honeypot emails into your auth endpoint.
2. **The Hard Bounce Spike:** Downstream providers (AWS SES, Resend, SendGrid) dispatch to dead mailboxes and record hard bounces.
3. **The 5% Cliff:** AWS SES places accounts with bounce rates exceeding **5% on immediate probation** and shuts off sending completely at **10%**.
4. **The Damage:** Real customers stop receiving login links, verification tokens, and Stripe payment receipts.

> **Retrospective suppression lists (SNS/SQS) fail to prevent this** because the reputation damage is recorded the second the email leaves the upstream server.

---

## 🛡️ The Architecture

SentriSend sits as a stateless, pre-flight security layer between your application backend and your downstream email provider:

```text
[ Application / Next.js / Supabase Auth ]
                    │
                    ▼
      [ SentriSend Security Gateway ]
                    │
    ┌───────────────┴───────────────────────────────┐
    ▼                                               ▼
1. Pre-Flight Threat Engine             2. Financial Attestation Enclave
   • In-memory disposable domain block     • Intercepts Sort Code/IBAN/Amount
   • Sub-2ms syntax & MX validation        • Cryptographic Merkle/SHA-256 seal
   • Rate limits & payload sanitization    • Bound to Companies House #17412179
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                [ Clean Delivery via AWS SES / Resend ]
                      (Bounce Rate Stays at 0.0%)
```

---

## 🚀 Quickstart: Send in 30 Seconds

Test the pre-flight gateway directly from your terminal using our default verified sandbox sender:

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

## 🔒 3-Minute Supabase Auth Integration

Protect your Supabase Auth endpoints from bot signup floods in Next.js:

```typescript
// pages/api/auth/send-verification.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email, token, type } = req.body;

  // Dispatch via SentriSend Pre-Flight Gateway
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
}
```

---

## 🏛️ Statutory Financial Attestation Enclave (BEC Defense)

SentriSend includes native protection against **Business Email Compromise (BEC)** and invoice redirection fraud ($2.9B annual global loss):

* **Automated Coordinate Detection:** Outgoing invoices are scanned for banking coordinates (Sort Codes, Account Numbers, IBANs, amounts).
* **Statutory Registry Binding:** Coordinates are hashed into a zero-knowledge claims proof bound to Bench Tech Audio Ltd’s statutory corporate registration (**UK Companies House No. 17412179**).
* **Tamper-Evident Header & Seal:** Injects `X-SentriSend-Attestation` and an emerald footer seal with public verification at:
  `https://sentrisend.com/verify/:proof_hash`
* **Result:** If an attacker intercepts the email and alters a single digit of the bank account, the cryptographic seal breaks immediately.

---

## 📜 Zero-Knowledge Privacy Standard

* **Zero PII Stored:** SentriSend stores no recipient email addresses, message bodies, or raw customer data in database logs.
* **Cryptographic Audit Trail:** Every dispatch generates an immutable SHA-256 HMAC proof for compliance under **UK GDPR**, **CCPA**, **P-Mark**, and **PIPA**.
* **Institutional Standing:** Officially listed on the **UK .gov official vendor directory**.

---

## 🔑 Free Developer Sandbox

Claim 100 free requests/month with zero credit card required:
👉 **[https://sentrisend.com](https://sentrisend.com)**

---

## 🏢 Corporate & Licensing

* **Parent Entity:** Bench Tech Audio Ltd (Company No: 17412179, England & Wales)
* **Registered Office:** Unit A, 82 James Carter Road, Mildenhall, Suffolk, IP28 7DE, UK
* **Founder & Lead Systems Architect:** Steve Danby