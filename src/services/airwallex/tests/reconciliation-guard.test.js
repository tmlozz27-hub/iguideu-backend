import test from "node:test";
import assert from "node:assert/strict";
import { validateAirwallexTransferIdentity as verify } from "../reconciliation-guard.js";

const booking = {
  airwallexTransferId: "TRANSFER_FAKE_001",
  airwallexRequestId: "REQUEST_FAKE_001",
  airwallexBeneficiaryId: "BENEFICIARY_FAKE_001"
};

const transfer = {
  id: "TRANSFER_FAKE_001",
  request_id: "REQUEST_FAKE_001",
  beneficiary_id: "BENEFICIARY_FAKE_001"
};

test("accepts matching transfer identity", () => {
  assert.equal(verify(booking, transfer), true);
});

test("rejects different transfer ID", () => {
  assert.throws(
    () => verify(booking, { ...transfer, id: "OTHER_TRANSFER" }),
    { message: "AIRWALLEX_TRANSFER_ID_MISMATCH" }
  );
});

test("rejects different request ID", () => {
  assert.throws(
    () => verify(booking, { ...transfer, request_id: "OTHER_REQUEST" }),
    { message: "AIRWALLEX_REQUEST_ID_MISMATCH" }
  );
});

test("rejects different beneficiary", () => {
  assert.throws(
    () => verify(booking, { ...transfer, beneficiary_id: "OTHER_BENEFICIARY" }),
    { message: "AIRWALLEX_BENEFICIARY_MISMATCH" }
  );
});
