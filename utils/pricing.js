// utils/pricing.js
// Lógica de precios para extensiones de reserva (por ahora: de 8 hs (DAY) a 24 hs).

/**
 * Calcula la extensión de una reserva de 8 hs (DAY) a 24 hs.
 * Regla de negocio:
 *  - Nuevo total = pricePer24h
 *  - Se cobra solo la diferencia = pricePer24h - yaPagado
 *
 * booking debe tener:
 *  - durationType: 'DAY'
 *  - hours: horas originales (normalmente 8)
 *  - totalAmountUsd: importe inicial pagado
 *  - currentTotalUsd (opcional): total actual si ya tuvo cambios
 *  - pricing: { pricePerHour, pricePerDay, pricePer24h }
 */
export function calculateExtensionTo24h(booking) {
  if (!booking) {
    throw new Error('No se recibió booking para calcular extensión');
  }

  if (!booking.pricing) {
    throw new Error('Booking sin pricing embebido');
  }

  const { pricePerHour, pricePerDay, pricePer24h } = booking.pricing;

  if (!pricePer24h) {
    throw new Error('No está definido pricePer24h para este booking');
  }

  // Usamos currentTotalUsd si existe, si no totalAmountUsd
  const alreadyPaid =
    booking.currentTotalUsd ??
    booking.totalAmountUsd ??
    0;

  // Solo soportamos por ahora DAY (8 hs) -> FULL_DAY_24H
  if (booking.durationType !== 'DAY') {
    throw new Error(
      `Solo se soporta extensión desde DAY (8 hs) a 24 hs en esta versión. durationType actual: ${booking.durationType}`
    );
  }

  const fromHours = booking.hours ?? 8;
  const toHours = 24;

  // Regla simple: total nuevo = pricePer24h
  const newTotal = pricePer24h;

  let extraToPay = newTotal - alreadyPaid;
  if (extraToPay < 0) {
    extraToPay = 0;
  }

  const extraHours = toHours - fromHours;

  return {
    fromHours,
    toHours,
    extraHours,
    newTotal,
    extraToPay,
    newDurationType: 'FULL_DAY_24H'
  };
}

