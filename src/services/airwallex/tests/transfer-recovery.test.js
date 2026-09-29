import assert from "node:assert/strict";
import { test } from "node:test";
import { recoverAirwallexSandboxTransfer } from "../transfer-recovery.js";

test("recover existing transfer without creating another payment", async () => {
  process.env.AIRWALLEX_ENV = "sandbox";
  process.env.AIRWALLEX_CLIENT_ID = "FAKE_CLIENT";
  process.env.AIRWALLEX_API_KEY = "FAKE_KEY";

  const originalFetch = globalThis.fetch;
  let createCalls = 0;
  let recordCalls = 0;

  const booking = {
    _id: "BOOKING_FAKE_001",
    airwallexRequestId: "REQUEST_FAKE_001",
    airwallexBeneficiaryId: "BENEFICIARY_FAKE_001",
    airwallexPayoutStatus: "PROCESSING",
    airwallexTransferId: ""
  };

  const MockBooking = {
    async findOneAndUpdate(filter, update) {
      recordCalls++;
      assert.equal(filter._id, booking._id);
      assert.equal(filter.airwallexRequestId, booking.airwallexRequestId);
      assert.equal(filter.airwallexPayoutStatus, "PROCESSING");
      assert.equal(update.$set.airwallexTransferId, "TRANSFER_FAKE_001");
      assert.equal(update.$set.airwallexBeneficiaryId, booking.airwallexBeneficiaryId);
      return { ...booking, ...update.$set };
    }
  };

  try {
    globalThis.fetch = async (url, options = {}) => {
      const address = String(url);

      if (address.endsWith("/authentication/login")) {
        return new Response(JSON.stringify({ token: "FAKE_TOKEN" }), { status: 200 });
      }

      if (address.includes("/transfers/create")) {
        createCalls++;
        throw new Error("CREATE_FORBIDDEN");
      }

      if (address.includes("/api/v1/transfers?")) {
        assert.equal(options.method, "GET");
        assert.equal(new URL(address).searchParams.get("request_id"), booking.airwallexRequestId);

        return new Response(JSON.stringify({
          items: [{
            id: "TRANSFER_FAKE_001",
            request_id: booking.airwallexRequestId,
            beneficiary_id: booking.airwallexBeneficiaryId
          }]
        }), { status: 200 });
      }

      throw new Error("UNEXPECTED_NETWORK_REQUEST");
    };

    const result = await recoverAirwallexSandboxTransfer(MockBooking, booking);

    assert.equal(result.airwallexTransferId, "TRANSFER_FAKE_001");
    assert.equal(createCalls, 0);
    assert.equal(recordCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log("AIRWALLEX_RECOVERY_PERMANENT_TEST_OK");
