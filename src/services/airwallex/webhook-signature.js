import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyAirwallexWebhookSignature({
  rawBody,
  timestamp,
  signature,
  secret,
  now = Date.now()
}) {
  if (!Buffer.isBuffer(rawBody)) return false;
  if (!secret || !timestamp || !signature) return false;

  const ts = String(timestamp);

  if (!/^\d{13}$/.test(ts)) return false;

  const age = Math.abs(now - Number(ts));

  if (!Number.isFinite(age) || age > 300000) return false;

  const expected = createHmac("sha256", secret)
    .update(ts)
    .update(rawBody)
    .digest();

  if (!/^[a-fA-F0-9]{64}$/.test(String(signature))) return false;

  const received = Buffer.from(String(signature), "hex");

  return timingSafeEqual(expected, received);
}
