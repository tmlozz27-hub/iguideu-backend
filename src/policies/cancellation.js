// src/policies/cancellation.js
const PUBLIC_CANCELLATION_POLICY = {
  policy: "cancellation",
  traveler: {
    windows: [
      { minHoursBefore: 48, refundPct: 100 },
      { minHoursBefore: 24, refundPct: 50 },
      { minHoursBefore: 0,  refundPct: 0 },
    ],
  },
  guide: {
    windows: [{ minHoursBefore: 0, refundPct: 100 }],
  },
  forceMajeure: [
    "Accidente o emergencia médica",
    "Fallecimiento de familiar directo",
    "Clima extremo o desastre",
    "Cierre gubernamental o seguridad",
  ],
  note: "Resumen público; la liquidación real la calcula el backend en /api/bookings",
  updatedAt: new Date().toISOString(),
};

function evaluateCancellation(booking, actor, reason, now = new Date()) {
  if (!booking || typeof booking.price !== "number" || !booking.startAt) {
    throw new Error("Invalid booking for cancellation evaluation");
  }
  const start = new Date(booking.startAt);
  const msBefore = start.getTime() - now.getTime();
  const hoursBefore = Math.max(0, Math.floor(msBefore / (1000 * 60 * 60)));

  const price = booking.price;
  let refundPct = 0;

  if (String(reason).toLowerCase().includes("force")) {
    refundPct = 100;
  } else if (actor === "traveler") {
    const w = PUBLIC_CANCELLATION_POLICY.traveler.windows.find(
      x => hoursBefore >= x.minHoursBefore
    ) || { refundPct: 0 };
    refundPct = w.refundPct;
  } else if (actor === "guide") {
    refundPct = 100;
  }

  const refundToTraveler = Math.round(price * (refundPct / 100));
  const keepByGuide = Math.max(0, price - refundToTraveler);

  return {
    actor,
    reason,
    hoursBefore,
    refundPct,
    refundToTraveler,
    keepByGuide,
    fee: 0,
  };
}

module.exports = { PUBLIC_CANCELLATION_POLICY, evaluateCancellation };
