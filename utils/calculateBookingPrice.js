// utils/calculateBookingPrice.js
// Aplica la REGLA FINAL OFICIAL de duraciones I GUIDE U
//
// 1 a 7 hs   → hourly
// 8 hs       → daily (8h)
// 9 a 11 hs  → daily + horas extra
// 12 hs      → si hay promo12hRate, usar promo; si no, daily + horas extra
// 13 a 23 hs → FULL DAY 24h
// 24 hs      → FULL DAY 24h

/**
 * Calcula el precio bruto según la regla oficial.
 *
 * @param {Object} params
 * @param {Object} params.guide   - Documento de Guide (con hourlyRate, dailyRate, promo12hRate, fullDay24hRate)
 * @param {number} params.hours   - Horas totales seleccionadas por el viajero (1 a 24)
 * @param {number} [params.platformFeePercent=0.10] - Comisión de la plataforma (0.10 = 10%)
 *
 * @returns {{
 *   amount: number,
 *   platformFee: number,
 *   guideAmount: number,
 *   durationType: string,
 *   breakdown: object
 * }}
 */
export function calculateBookingPrice({
  guide,
  hours,
  platformFeePercent = 0.10,
}) {
  if (!guide) {
    throw new Error("calculateBookingPrice: falta el guía.");
  }

  if (!Number.isInteger(hours) || hours < 1 || hours > 24) {
    throw new Error("calculateBookingPrice: horas inválidas (1 a 24).");
  }

  const hourly = guide.hourlyRate;
  const daily = guide.dailyRate;

  if (typeof hourly !== "number" || typeof daily !== "number") {
    throw new Error(
      "calculateBookingPrice: el guía no tiene hourlyRate/dailyRate válidos."
    );
  }

  // Promo 12h opcional
  const promo12h =
    typeof guide.promo12hRate === "number" && guide.promo12hRate > 0
      ? guide.promo12hRate
      : null;

  // Si no definiste fullDay24hRate en el guía, lo calculo como 2 días.
  const fullDay24h =
    typeof guide.fullDay24hRate === "number" && guide.fullDay24hRate > 0
      ? guide.fullDay24hRate
      : Math.round(daily * 2);

  let amount = 0;
  let durationType = "HOURS";
  let breakdown = {};

  // 1) 1 a 7 horas → hourly
  if (hours >= 1 && hours <= 7) {
    amount = hourly * hours;
    durationType = "HOURS";
    breakdown = {
      mode: "HOURS",
      hours,
      hourly,
      base: amount,
    };
  }

  // 2) 8 horas exactas → daily
  else if (hours === 8) {
    amount = daily;
    durationType = "DAY_8H";
    breakdown = {
      mode: "DAY_8H",
      hours,
      daily,
      base: daily,
    };
  }

  // 3) 9 a 11 horas → day + horas extra
  else if (hours >= 9 && hours <= 11) {
    const extraHours = hours - 8;
    const extraAmount = hourly * extraHours;

    amount = daily + extraAmount;
    durationType = "DAY_8H_PLUS_EXTRA";
    breakdown = {
      mode: "DAY_8H_PLUS_EXTRA",
      hours,
      daily,
      extraHours,
      hourly,
      baseDay: daily,
      extraAmount,
      total: amount,
    };
  }

  // 4) 12 horas → promo12hRate si existe, si no day + extras
  else if (hours === 12) {
    if (promo12h !== null) {
      amount = promo12h;
      durationType = "PROMO_12H";
      breakdown = {
        mode: "PROMO_12H",
        hours,
        promo12h,
        note:
          "Se aplica precio especial de 12h definido por el guía (promo12hRate).",
      };
    } else {
      const extraHours = hours - 8; // 4 horas extra
      const extraAmount = hourly * extraHours;

      amount = daily + extraAmount;
      durationType = "DAY_8H_PLUS_EXTRA";
      breakdown = {
        mode: "DAY_8H_PLUS_EXTRA",
        hours,
        daily,
        extraHours,
        hourly,
        baseDay: daily,
        extraAmount,
        total: amount,
        note:
          "No hay promo12hRate, se usa cálculo normal (día + horas extra).",
      };
    }
  }

  // 5) 13 a 23 horas → FULL DAY 24h (tarifa unificada)
  else if (hours >= 13 && hours <= 23) {
    amount = fullDay24h;
    durationType = "FULL_DAY_24H";
    breakdown = {
      mode: "FULL_DAY_24H_UNIFIED",
      hours,
      fullDay24h,
      note: "13 a 23 horas → se cobra como FULL DAY 24h.",
    };
  }

  // 6) 24 horas exactas → FULL DAY 24h
  else if (hours === 24) {
    amount = fullDay24h;
    durationType = "FULL_DAY_24H";
    breakdown = {
      mode: "FULL_DAY_24H",
      hours,
      fullDay24h,
    };
  }

  // Comisión plataforma + monto para el guía
  const platformFee = Math.round(amount * platformFeePercent);
  const guideAmount = amount - platformFee;

  return {
    amount, // total en USD
    platformFee,
    guideAmount,
    durationType,
    breakdown,
  };
}
