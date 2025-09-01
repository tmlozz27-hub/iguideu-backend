// scripts/test-cancellation.js
const assert = require("assert");
const { evaluateCancellation } = require("../src/policies/cancellation");

function mkBooking(startInHours) {
  const now = new Date();
  const start = new Date(now.getTime() + startInHours * 60 * 60 * 1000);
  return {
    _id: "test",
    traveler: "t@x.com",
    guide: "g1",
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    price: 100,
    status: "confirmed",
  };
}

(function run(){
  // Traveler
  assert.equal(evaluateCancellation({ booking: mkBooking(60), who:"traveler"}).travelerRefundPct, 100);
  assert.equal(evaluateCancellation({ booking: mkBooking(24), who:"traveler"}).travelerRefundPct, 50);
  assert.equal(evaluateCancellation({ booking: mkBooking(6), who:"traveler"}).travelerRefundPct, 0);

  // Guide
  assert.equal(evaluateCancellation({ booking: mkBooking(60), who:"guide"}).guidePenaltyPct, 0);
  assert.equal(evaluateCancellation({ booking: mkBooking(24), who:"guide"}).guidePenaltyPct, 20);
  assert.equal(evaluateCancellation({ booking: mkBooking(6), who:"guide"}).guidePenaltyPct, 50);
  // FM
  assert.equal(evaluateCancellation({ booking: mkBooking(1), who:"traveler", forceMajeure:true}).travelerRefundPct, 100);
  assert.equal(evaluateCancellation({ booking: mkBooking(1), who:"guide", forceMajeure:true}).guidePenaltyPct, 0);

  console.log("✅ cancellation.js unit tests OK");
})();
