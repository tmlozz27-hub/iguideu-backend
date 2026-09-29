import test from "node:test";
import assert from "node:assert/strict";
import { persistAirwallexReconciliation } from "../reconciliation-store.js";

const booking = {
  _id: "BOOKING_FAKE_001",
  airwallexTransferId: "TRANSFER_FAKE_001",
  airwallexRequestId: "REQUEST_FAKE_001",
  airwallexBeneficiaryId: "BENEFICIARY_FAKE_001",
  airwallexPayoutStatus: "PROCESSING"
};

const transfer = {
  id: "TRANSFER_FAKE_001",
  request_id: "REQUEST_FAKE_001",
  beneficiary_id: "BENEFICIARY_FAKE_001",
  status: "SENT"
};

test("accepts duplicate when desired state was already stored", async () => {
  let writes = 0;

  const Booking = {
    async findOneAndUpdate() {
      writes++;
      return null;
    },
    async findById() {
      return { ...booking, airwallexPayoutStatus: "SENT" };
    }
  };

  const result = await persistAirwallexReconciliation(
    Booking, booking, transfer
  );

  assert.equal(result.airwallexPayoutStatus, "SENT");
  assert.equal(writes, 1);
});

test("rejects a genuine concurrent state conflict", async () => {
  const Booking = {
    async findOneAndUpdate() {
      return null;
    },
    async findById() {
      return {
        ...booking,
        airwallexPayoutStatus: "RECONCILIATION_REQUIRED"
      };
    }
  };

  await assert.rejects(
    persistAirwallexReconciliation(Booking, booking, transfer),
    { message: "AIRWALLEX_RECONCILIATION_CONFLICT" }
  );
});
