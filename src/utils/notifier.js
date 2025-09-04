// src/utils/notifier.js

function pretty(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/**
 * notify(event, booking)
 * event: 'confirmed' | 'canceled' | 'pending' | 'created' | etc
 * booking: { _id, traveler, guide, status, startAt, endAt, cancelInfo? }
 */
function notify(event, booking) {
  // Pequeño “snapshot” seguro para log
  const base = {
    _id: booking?._id,
    traveler: booking?.traveler,
    guide: booking?.guide,
    status: booking?.status,
    startAt: booking?.startAt,
    endAt: booking?.endAt,
  };

  if (event === 'canceled') {
    const cancelInfo = booking?.cancelInfo || {};
    // OJO: el motivo real está en cancelInfo.reason (no en settlement)
    const payload = {
      ...base,
      cancelInfo: {
        at: cancelInfo.at,
        reason: cancelInfo.reason,
        settlement: cancelInfo.settlement
          ? {
              actor: cancelInfo.settlement.actor,
              reason: cancelInfo.reason, // <- mostramos acá el reason real
              hoursBefore: cancelInfo.settlement.hoursBefore,
              refundPct: cancelInfo.settlement.refundPct,
              refundToTraveler: cancelInfo.settlement.refundToTraveler,
              keepByGuide: cancelInfo.settlement.keepByGuide,
              fee: cancelInfo.settlement.fee,
            }
          : undefined,
      },
    };
    console.log('[NOTIFY] canceled', payload);
    return;
  }

  if (event === 'confirmed') {
    console.log('[NOTIFY] confirmed', base);
    return;
  }

  // fallback
  console.log(`[NOTIFY] ${event}`, pretty(booking));
}

module.exports = { notify };
