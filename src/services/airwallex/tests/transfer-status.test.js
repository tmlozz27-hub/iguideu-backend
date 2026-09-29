import assert from "node:assert/strict";
import { classifyAirwallexTransfer } from "../transfer-status.js";

const transfer = (status) => ({
  id: "SANDBOX_TRANSFER_001",
  status
});

assert.equal(classifyAirwallexTransfer(transfer("PROCESSING")), "PROCESSING");
assert.equal(classifyAirwallexTransfer(transfer("PENDING")), "PROCESSING");
assert.equal(classifyAirwallexTransfer(transfer("SCHEDULED")), "PROCESSING");
assert.equal(classifyAirwallexTransfer(transfer("SENT")), "SENT");

assert.equal(
  classifyAirwallexTransfer(transfer("PAID")),
  "RECONCILIATION_REQUIRED"
);

assert.equal(
  classifyAirwallexTransfer(transfer("FAILED")),
  "RECONCILIATION_REQUIRED"
);

assert.equal(
  classifyAirwallexTransfer(transfer("UNKNOWN")),
  "RECONCILIATION_REQUIRED"
);

assert.throws(
  () => classifyAirwallexTransfer({ status: "PAID" }),
  /AIRWALLEX_TRANSFER_DETAILS_REQUIRED/
);

console.log("AIRWALLEX_TRANSFER_STATUS_TEST_OK");
