// src/policies/cancellation.js
const publicView = {
  version: '1.0',
  updatedAt: new Date().toISOString(),
  traveler: [
    { window: '>48h', refundPct: 100, code: 'traveler_full_refund' },
    { window: '48–12h', refundPct: 50, code: 'traveler_half_refund' },
    { window: '<12h', refundPct: 0, code: 'traveler_no_refund' }
  ],
  guide: [
    { window: '>48h', penaltyPct: 0, code: 'guide_no_penalty' },
    { window: '48–12h', penaltyPct: 20, code: 'guide_mid_penalty' },
    { window: '<12h', penaltyPct: 50, code: 'guide_high_penalty' }
  ],
  forceMajeure: [
    'accident', 'illness', 'family_bereavement', 'extreme_weather'
  ]
};

// Si ya tenés la lógica compute*, mantenela. Solo aseguramos exportar "public".
module.exports = {
  public: publicView,
  // ... (tus funciones/exports reales para calcular penalidades y refunds)
};
