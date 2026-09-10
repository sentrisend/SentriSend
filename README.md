# SentriSend 🛡️

> **The Outbound Email Security & Anomaly Firewall**  
> Protect your domain reputation from bounce spikes, form injection attacks, and provider suspensions (AWS SES, SendGrid, Resend).

[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://sentrisend.com)
[![Zero-PII](https://img.shields.io/badge/Security-Zero--PII%20Enclave-green.svg)](https://sentrisend.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## The Problem
When transactional forms (password resets, team invites, contact forms) are exploited by automated bots or runaway scripts, bounce rates frequently spike past **5%**. 

Major delivery providers (AWS SES, SendGrid, Resend) will **instantly suspend your production domain with zero warning**, breaking user onboarding and customer receipts.

---

## The Solution
**SentriSend** acts as a pre-flight circuit breaker between your application and your email delivery provider.

* 🛡️ **Pre-flight Anomaly Engine:** Intercepts and blocks batch credential attacks and internal domain spoofing in real time.
* 🌐 **Collective Threat Graph:** Real-time shared network immunity that learns from attacks across all connected applications.
* 🔒 **Zero-Knowledge Cryptographic Enclave:** Issues unforgeable SHA-256 tamper-evident compliance proofs to Supabase with email bodies automatically redacted.
* ⚡ **Lightning Fast:** Sub-50ms latency overhead.

---

## Quickstart (Node.js & TypeScript)

Install or drop the client into your project:

```typescript
import { SentriSend } from 'sentrisend';

const client = new SentriSend({
  apiKey: 'YOUR_SENTRISEND_API_KEY'
});

const result = await client.emails.send({
  to: 'user@example.com',
  subject: 'Your Monthly Invoice',
  html: '<p>Thank you for your business.</p>',
  intendedUse: 'Billing receipt'
});

console.log(result.status); // "DELIVERED"
console.log(result.complianceProof); // "sha256:fae2...1ad3"
```

---

## Live Production Dashboard
Access live telemetry, manage API keys, and monitor threats in real time:

👉 **[https://sentrisend.com](https://sentrisend.com)**

* **English Hub:** [https://sentrisend.com](https://sentrisend.com)
* **Japanese Hub (日本語):** [https://sentrisend.com/ja](https://sentrisend.com/ja)
* **Korean Hub (한국어):** [https://sentrisend.com/ko](https://sentrisend.com/ko)

---

## Compliance & Legal
SentriSend is a dedicated developer security division of **Bench Tech Audio Ltd** (UK Company No. 17412179).  
Adheres to strict data minimization under UK GDPR. Body content is redacted in transit and never stored unencrypted.
