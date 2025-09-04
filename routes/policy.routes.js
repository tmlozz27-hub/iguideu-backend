const express = require('express');
const router = express.Router();

/**
 * Política simple de reembolso:
 * - >=48h antes: 100% refund
 * - <48h y >=24h: 50%
 * - <24h: 0%
 */
function refundPct(hoursBefore) {
  if (hoursBefore >= 48) return 100;
  if (hoursBefore >= 24) return 50;
  return 0;
}

router.get('/policy/cancel', (req, res) => {
  res.json({
    name: 'simple',
    tiers: [
      { minHoursBefore: 48, refundPct: 100 },
      { minHoursBefore: 24, refundPct: 50 },
      { minHoursBefore: 0, refundPct: 0 },
    ],
  });
});

module.exports = router;
