// Pre-flight check for a signup form. Fails open: only a definite
// "allowed: false" verdict (or a malformed address) blocks the user.
export async function checkEmail(email, { apiKey, baseUrl = "https://sentrisend.com/api/v1", timeoutMs = 800 } = {}) {
  try {
    const res = await fetch(`${baseUrl}/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json().catch(() => ({}));

    if (res.status === 200) return { ok: true, verdict: body };                       // allowed (including DNS_INCONCLUSIVE)
    if (res.status === 400 && body.allowed === false) return { ok: false, reason: body.reason }; // disposable / no such domain / no mail records
    if (res.status === 400 && body.code === "INVALID_EMAIL") return { ok: false, reason: "INVALID_EMAIL" };
    return { ok: true, skipped: true, status: res.status };                           // 401, 403, 429, 503 ...: do not block your user
  } catch {
    return { ok: true, skipped: true };                                              // timeout or network error: do not block your user
  }
}
