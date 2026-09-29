import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import express from "express";
import Booking from "../../../models/Booking.js";
import webhookRouter from "../../../routes/airwallex.webhook.routes.js";

test("signed webhook reconciles a transfer before returning HTTP 200", async () => {
  const originalFetch = globalThis.fetch;
  const originalFindOne = Booking.findOne;
  const originalUpdate = Booking.findOneAndUpdate;

  const envNames = [
    "AIRWALLEX_ENV",
    "AIRWALLEX_WEBHOOK_SECRET",
    "AIRWALLEX_CLIENT_ID",
    "AIRWALLEX_API_KEY"
  ];
  const previousEnv = Object.fromEntries(
    envNames.map(name => [name, process.env[name]])
  );

  process.env.AIRWALLEX_ENV = "sandbox";
  process.env.AIRWALLEX_WEBHOOK_SECRET = "LOCAL_FAKE_SECRET_ONLY";
  process.env.AIRWALLEX_CLIENT_ID = "FAKE_CLIENT";
  process.env.AIRWALLEX_API_KEY = "FAKE_KEY";

  const booking = {
    _id: "BOOKING_FAKE_001",
    airwallexTransferId: "TRANSFER_FAKE_001",
    airwallexRequestId: "REQUEST_FAKE_001",
    airwallexBeneficiaryId: "BENEFICIARY_FAKE_001",
    airwallexPayoutStatus: "PROCESSING"
  };

  let queries = 0;
  let updates = 0;
  let server;

  try {
    globalThis.fetch = async url => {
      const address = String(url);

      if (address.endsWith("/authentication/login")) {
        return new Response(JSON.stringify({ token: "FAKE_TOKEN" }), {
          status: 200
        });
      }

      if (address.endsWith("/transfers/TRANSFER_FAKE_001")) {
        queries++;
        return new Response(JSON.stringify({
          id: "TRANSFER_FAKE_001",
          request_id: "REQUEST_FAKE_001",
          beneficiary_id: "BENEFICIARY_FAKE_001",
          status: "SENT"
        }), { status: 200 });
      }

      throw new Error("UNEXPECTED_EXTERNAL_REQUEST");
    };

    Booking.findOne = async () => booking;

    Booking.findOneAndUpdate = async (filter, update) => {
      updates++;
      assert.equal(filter.airwallexTransferId, booking.airwallexTransferId);
      assert.equal(filter.airwallexPayoutStatus, "PROCESSING");
      assert.equal(update.$set.airwallexPayoutStatus, "SENT");
      return { ...booking, airwallexPayoutStatus: "SENT" };
    };

    const app = express();
    app.use("/api/airwallex/webhook", express.raw({
      type: "application/json"
    }));
    app.use("/api/airwallex/webhook", webhookRouter);

    server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));

    const body = JSON.stringify({
      id: "EVENT_FAKE_001",
      name: "payout.transfer.sent",
      data: { object: { id: "TRANSFER_FAKE_001" } }
    });

    const timestamp = String(Date.now());
    const signature = createHmac(
      "sha256",
      process.env.AIRWALLEX_WEBHOOK_SECRET
    ).update(timestamp).update(body).digest("hex");

    const response = await originalFetch(
      `http://127.0.0.1:${server.address().port}/api/airwallex/webhook`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-timestamp": timestamp,
          "x-signature": signature
        },
        body
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true });
    assert.equal(queries, 1);
    assert.equal(updates, 1);
  } finally {
    globalThis.fetch = originalFetch;
    Booking.findOne = originalFindOne;
    Booking.findOneAndUpdate = originalUpdate;

    for (const name of envNames) {
      if (previousEnv[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[name];
    }

    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  }
});
