// pages/api/auth/supabase-hook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Webhook } from 'standardwebhooks';

// Disable Next.js body parser to verify the raw Standard Webhook signature
// (For App Router, read the raw body using `await req.text()` instead)
export const config = {
  api: {
    bodyParser: false,
  },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBJECT_MAP: Record<string, string> = {
  signup: 'Verify your account',
  recovery: 'Reset your password',
  magiclink: 'Your magic login link',
  reauthentication: 'Confirm your identity'
};
const SUPPORTED_TYPES = new Set(Object.keys(SUBJECT_MAP));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // 1. Verify Standard Webhooks Signature (Svix standard used by Supabase)
  let payload: any;
  try {
    const rawBody = (await getRawBody(req)).toString('utf8');
    const secret = (process.env.SEND_EMAIL_HOOK_SECRET || '').replace('v1,whsec_', '');
    const wh = new Webhook(secret);
    payload = wh.verify(rawBody, req.headers as Record<string, string>);
  } catch (err) {
    return res.status(401).json({ error: { http_code: 401, message: 'Invalid webhook signature' } });
  }

  // 2. Extract & Validate Supabase Payload
  const { user, email_data } = payload;
  const email = user?.email;
  const token = email_data?.token; // 6-digit numeric OTP code
  const tokenHash = email_data?.token_hash; // Hash used for confirmation links
  const redirectTo = email_data?.redirect_to || process.env.NEXT_PUBLIC_SITE_URL || '';
  const type = email_data?.email_action_type || 'signup';

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email) || email.length > 254) {
    return res.status(400).json({ error: { http_code: 400, message: 'Invalid recipient address' } });
  }

  // Explicitly guard against unsupported action types (e.g. email_change / invite)
  if (!SUPPORTED_TYPES.has(type)) {
    return res.status(400).json({ error: { http_code: 400, message: `Unsupported auth action type: ${type}` } });
  }

  // 3. Pre-Flight Threat Check via SentriSend (600ms timeout)
  // Timeouts throw to catch; 429s, 5xx, and parse errors fall through safely to the mailer.
  // Note: Enable Cloudflare Turnstile & Supabase native rate limits in your Supabase Auth 
  // dashboard settings to prevent bot floods from exhausting your API quota or email bombing.
  try {
    const check = await fetch('https://sentrisend.com/api/v1/validate', {
      method: 'POST',
      signal: AbortSignal.timeout(600), // Accommodates serverless cold starts
      headers: {
        'Authorization': `Bearer ${process.env.SENTRISEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    const data = await check.json().catch(() => ({}));

    // Block ONLY when explicitly flagged as a threat
    if (data.allowed === false || data.disposable === true) {
      return res.status(400).json({
        error: {
          http_code: 400,
          message: 'Unsupported or high-risk email address rejected.'
        }
      });
    }

    if (check.status === 401) {
      console.error('[SentriSend 401]: Invalid SENTRISEND_API_KEY configured');
    }
  } catch (err) {
    // Fail-Open on timeout: Real users are never blocked by network latency
    console.warn('[SentriSend Timeout - Failing Open to Mailer]:', err);
  }

  // 4. Dispatch Email via Upstream Provider (AWS SES / Resend)
  try {
    const subject = SUBJECT_MAP[type];
    const sendResult = await sendEmailViaProvider({ email, token, tokenHash, type, redirectTo, subject });

    if (!sendResult.ok) {
      return res.status(502).json({ error: { http_code: 502, message: sendResult.error || 'Upstream delivery failed' } });
    }

    // Supabase Auth strictly expects an empty JSON object on hook success
    return res.status(200).json({});
  } catch (err) {
    return res.status(500).json({ error: { http_code: 500, message: 'Internal delivery failure' } });
  }
}

// Mailer dispatch (Resend / AWS SES) supporting both Link and OTP Code
async function sendEmailViaProvider({ email, token, tokenHash, type, redirectTo, subject }: any) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  
  let htmlContent = '';
  // Only build verification link if tokenHash exists (e.g. signup / recovery / magiclink)
  if (tokenHash) {
    const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(redirectTo)}`;
    htmlContent += `<p><a href="${verifyUrl}">Click here to complete authentication</a></p>`;
  }
  // Render OTP code if present (e.g. 6-digit code or reauthentication)
  if (token) {
    htmlContent += `<p>Or enter this verification code: <strong>${token}</strong></p>`;
  }

  // Guard against dispatching empty payloads
  if (!htmlContent) {
    return { ok: false, error: 'Missing token or verification link payload' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Your App <auth@yourdomain.com>',
      to: email,
      subject,
      html: htmlContent
    })
  });
  return { ok: response.ok, error: response.ok ? null : await response.text().catch(() => 'Send error') };
}

// Helper: Read raw request stream for signature verification
async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}