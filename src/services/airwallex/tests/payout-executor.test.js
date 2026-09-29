import assert from "node:assert/strict";
import { executeAirwallexSandboxPayout } from "../payout-executor.js";

process.env.AIRWALLEX_ENV = "sandbox";
process.env.AIRWALLEX_CLIENT_ID = "FAKE_CLIENT_ID";
process.env.AIRWALLEX_API_KEY = "FAKE_API_KEY";

const originalFetch = globalThis.fetch;
let createCalls = 0;
let recordCalls = 0;

const booking = {
  _id: "BOOKING_FAKE_001",
  guideId: "GUIDE_FAKE_001",
  status: "COMPLETED",
  guidePayoutStatus: "READY",
  stripePaymentIntentId: "pi_FAKE_001",
  stripeTransferId: "",
  guidePayoutEligibleAt: new Date(Date.now() - 60000),
  amountCents: 1000,
  guidePayoutAmountCents: 900,
  currency: "usd",
  airwallexTransferId: "",
  airwallexPayoutStatus: "NOT_STARTED"
};

const guide = {
  _id: "GUIDE_FAKE_001",
  airwallex: {
    beneficiaryId: "BENEFICIARY_FAKE_001",
    beneficiaryVerified: true,
    beneficiaryVerifiedAt: new Date()
  }
};

const MockBooking = {
  async findOneAndUpdate(filter, update) {
    if (update.$set.airwallexRequestId) {
      assert.equal(filter.amountCents, 1000);
      assert.equal(filter.guidePayoutAmountCents, 900);
      assert.equal(update.$set.airwallexBeneficiaryId, "BENEFICIARY_FAKE_001");
      assert.equal(createCalls, 0);
      return { ...booking, ...update.$set };
    }

    recordCalls++;
    assert.equal(update.$set.airwallexTransferId, "TRANSFER_FAKE_001");
    assert.equal(update.$set.airwallexBeneficiaryId, "BENEFICIARY_FAKE_001");

    return { ...booking, ...update.$set };
  }
};

try {
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/authentication/login")) {
      return new Response(
        JSON.stringify({ token: "FAKE_TOKEN" }),
        { status: 200 }
      );
    }

    if (url.endsWith("/transfers/create")) {
      createCalls++;

      const payload = JSON.parse(options.body);

      assert.equal(payload.source_amount, "9.00");
      assert.equal(payload.source_currency, "USD");
      assert.equal(payload.transfer_currency, "ARS");
        assert.equal(payload.transfer_method, "LOCAL");
      assert.equal(payload.fee_paid_by, "PAYER");
      assert.equal(payload.reason, "travel");
      assert.equal(Object.hasOwn(payload, "transfer_amount"), false);
      assert.equal(payload.beneficiary_id, "BENEFICIARY_FAKE_001");
      assert.ok(payload.request_id);

      return new Response(
        JSON.stringify({ id: "TRANSFER_FAKE_001" }),
        { status: 200 }
      );
    }

    throw new Error("UNEXPECTED_NETWORK_REQUEST");
  };

  const result = await executeAirwallexSandboxPayout(
    MockBooking,
    booking,
    guide
  );

  assert.equal(result.airwallexTransferId, "TRANSFER_FAKE_001");
  assert.equal(result.airwallexBeneficiaryId, "BENEFICIARY_FAKE_001");
  assert.equal(createCalls, 1);
  assert.equal(recordCalls, 1);

  console.log("AIRWALLEX_EXECUTOR_FULL_MOCK_TEST_OK");
} finally {
  globalThis.fetch = originalFetch;
}
