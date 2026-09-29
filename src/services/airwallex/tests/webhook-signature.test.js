import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyAirwallexWebhookSignature as verify } from "../webhook-signature.js";

const now = 1800000000000;
const timestamp = String(now);
const secret = "SOLO_PRUEBA_LOCAL";
const rawBody = Buffer.from(JSON.stringify({ id: "evt_test", name: "test.event" }));

function sign(ts, body) {
  return createHmac("sha256", secret)
    .update(ts)
    .update(body)
    .digest("hex");
}

test("accepts valid signature", () => {
  assert.equal(verify({
    rawBody, timestamp,
    signature: sign(timestamp, rawBody),
    secret, now
  }), true);
});

test("rejects false signature", () => {
  assert.equal(verify({
    rawBody, timestamp,
    signature: "0".repeat(64),
    secret, now
  }), false);
});

test("rejects modified body", () => {
  const modifiedBody = Buffer.from(JSON.stringify({ id: "evt_modified" }));

  assert.equal(verify({
    rawBody: modifiedBody,
    timestamp,
    signature: sign(timestamp, rawBody),
    secret, now
  }), false);
});

test("rejects expired timestamp", () => {
  const oldTimestamp = String(now - 600000);

  assert.equal(verify({
    rawBody,
    timestamp: oldTimestamp,
    signature: sign(oldTimestamp, rawBody),
    secret, now
  }), false);
});

test("rejects missing original raw body", () => {
  assert.equal(verify({
    rawBody: undefined,
    timestamp,
    signature: sign(timestamp, rawBody),
    secret, now
  }), false);
});
